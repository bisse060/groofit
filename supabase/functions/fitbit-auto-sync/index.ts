import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting automatic Fitbit sync for all users...');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users with Fitbit connected
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, fitbit_user_id, full_name')
      .not('fitbit_user_id', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users with Fitbit connected`);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users with Fitbit connected',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const results = [];

    // Sync each user
    for (const profile of profiles) {
      try {
        console.log(`Syncing user ${profile.full_name} (${profile.id})...`);
        
        // Sync activity data
        const syncData = await syncUserData(
          supabaseAdmin,
          profile.id,
          today
        );

        // Sync sleep data for yesterday and today
        await syncSleepData(supabaseAdmin, profile.id, yesterdayStr);
        await syncSleepData(supabaseAdmin, profile.id, today);

        console.log(`Sync successful for user ${profile.id}`);
        results.push({
          userId: profile.id,
          name: profile.full_name,
          success: true,
          data: syncData
        });
      } catch (userError) {
        console.error(`Error syncing user ${profile.id}:`, userError);
        results.push({
          userId: profile.id,
          name: profile.full_name,
          success: false,
          error: userError instanceof Error ? userError.message : 'Unknown error'
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Sync complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: profiles.length,
        successful,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-auto-sync:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncUserData(supabaseClient: any, userId: string, date: string) {
  try {
    // Get profile with Fitbit tokens
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('fitbit_user_id, fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.fitbit_user_id) {
      throw new Error('Fitbit not connected');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabaseClient, userId, profile);

    // Fetch activity data from Fitbit
    const activityResponse = await fetch(
      `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      console.error('Fitbit API error:', errorText);
      throw new Error('Failed to fetch Fitbit data');
    }

    const activityData = await activityResponse.json();
    const steps = activityData.summary?.steps || 0;
    const caloriesOut = activityData.summary?.caloriesOut || 0;

    // Upsert daily log
    const { error: upsertError } = await supabaseClient
      .from('daily_logs')
      .upsert({
        user_id: userId,
        log_date: date,
        steps: steps,
        calorie_burn: caloriesOut,
        synced_from_fitbit: true,
      }, {
        onConflict: 'user_id,log_date',
      });

    if (upsertError) {
      throw upsertError;
    }

    // Update last sync time
    await supabaseClient
      .from('profiles')
      .update({ fitbit_last_sync_at: new Date().toISOString() })
      .eq('id', userId);

    // Log sync
    await supabaseClient
      .from('fitbit_sync_logs')
      .insert({
        user_id: userId,
        sync_date: date,
        status: 'success',
        message: `Auto-synced ${steps} steps and ${caloriesOut} calories`,
      });

    return {
      steps,
      calories_out: caloriesOut,
      date
    };
  } catch (error) {
    // Log failed sync
    await supabaseClient
      .from('fitbit_sync_logs')
      .insert({
        user_id: userId,
        sync_date: date,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    throw error;
  }
}

async function refreshTokenIfNeeded(supabaseClient: any, userId: string, profile: any) {
  const expiresAt = new Date(profile.fitbit_token_expires_at);
  
  if (expiresAt > new Date()) {
    return profile.fitbit_access_token;
  }

  console.log('Token expired, refreshing...');
  
  const clientId = Deno.env.get('FITBIT_CLIENT_ID');
  const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET');
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const refreshResponse = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: profile.fitbit_refresh_token,
    }),
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error('Token refresh error:', errorText);
    throw new Error('Failed to refresh Fitbit token');
  }

  const tokenData = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  await supabaseClient
    .from('profiles')
    .update({
      fitbit_access_token: tokenData.access_token,
      fitbit_refresh_token: tokenData.refresh_token,
      fitbit_token_expires_at: newExpiresAt.toISOString(),
    })
    .eq('id', userId);

  return tokenData.access_token;
}

async function syncSleepData(supabaseClient: any, userId: string, date: string) {
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
      .eq('id', userId)
      .single();

    if (!profile?.fitbit_access_token) {
      return;
    }

    const accessToken = await refreshTokenIfNeeded(supabaseClient, userId, profile);

    const fitbitUrl = `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`;
    const fitbitResponse = await fetch(fitbitUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fitbitResponse.ok) {
      console.error('Fitbit sleep API error for user', userId);
      return;
    }

    const data = await fitbitResponse.json();
    const mainLog = data.sleep?.[0];
    
    if (!mainLog) {
      console.log(`No sleep data for user ${userId} on ${date}`);
      return;
    }

    const sleepData = {
      user_id: userId,
      date,
      duration_minutes: Math.floor(mainLog.duration / 60000),
      efficiency: mainLog.efficiency || null,
      score: mainLog.efficiency || null,
      deep_minutes: mainLog.levels?.summary?.deep?.minutes || 0,
      rem_minutes: mainLog.levels?.summary?.rem?.minutes || 0,
      light_minutes: mainLog.levels?.summary?.light?.minutes || 0,
      wake_minutes: mainLog.levels?.summary?.wake?.minutes || 0,
      start_time: mainLog.startTime,
      end_time: mainLog.endTime,
      raw: data,
    };

    await supabaseClient
      .from('sleep_logs')
      .upsert(sleepData, { onConflict: 'user_id,date' });

    console.log(`Sleep data synced for user ${userId} on ${date}`);
  } catch (error) {
    console.error(`Error syncing sleep for user ${userId}:`, error);
  }
}
