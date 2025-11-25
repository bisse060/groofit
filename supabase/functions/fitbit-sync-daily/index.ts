import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { date } = await req.json();

    // Get profile with Fitbit tokens
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('fitbit_user_id, fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.fitbit_user_id) {
      throw new Error('Fitbit not connected');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabaseClient, user.id, profile);

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

    // Fetch weight data from Fitbit
    let weight = null;
    try {
      const weightResponse = await fetch(
        `https://api.fitbit.com/1/user/-/body/log/weight/date/${date}.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (weightResponse.ok) {
        const weightData = await weightResponse.json();
        // Get the most recent weight log for this date
        if (weightData.weight && weightData.weight.length > 0) {
          weight = weightData.weight[0].weight;
          console.log(`Found weight data: ${weight} kg`);
        }
      }
    } catch (weightError) {
      console.error('Error fetching weight data:', weightError);
      // Continue even if weight fetch fails
    }

    // Upsert daily log
    const { error: upsertError } = await supabaseClient
      .from('daily_logs')
      .upsert({
        user_id: user.id,
        log_date: date,
        steps: steps,
        calorie_burn: caloriesOut,
        weight: weight,
        synced_from_fitbit: true,
      }, {
        onConflict: 'user_id,log_date',
      });

    if (upsertError) {
      console.error('Error upserting daily log:', upsertError);
      throw upsertError;
    }

    // Update last sync time
    await supabaseClient
      .from('profiles')
      .update({ fitbit_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    // Log sync
    await supabaseClient
      .from('fitbit_sync_logs')
      .insert({
        user_id: user.id,
        sync_date: date,
        status: 'success',
        message: `Synced ${steps} steps, ${caloriesOut} calories${weight ? `, ${weight} kg` : ''}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        date: date,
        steps: steps,
        calories_out: caloriesOut,
        weight: weight,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-sync-daily:', error);
    
    // Log failed sync
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (user) {
        await supabaseClient
          .from('fitbit_sync_logs')
          .insert({
            user_id: user.id,
            sync_date: new Date().toISOString().split('T')[0],
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
      }
    } catch (logError) {
      console.error('Error logging failed sync:', logError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
