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

  // Verify this is called by an authorized service (cron job)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }
  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = '59bd9c2a-e112-4bd2-89e5-78cc6756aa60';
  if (token !== serviceRoleKey && token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    console.log('Starting automatic Fitbit sync for all users...');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users with Fitbit connected
    const { data: credentials, error: credentialsError } = await supabaseAdmin
      .from('fitbit_credentials')
      .select('user_id, fitbit_user_id')
      .not('fitbit_user_id', 'is', null);

    if (credentialsError) {
      console.error('Error fetching credentials:', credentialsError);
      throw credentialsError;
    }

    console.log(`Found ${credentials?.length || 0} users with Fitbit connected`);

    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users with Fitbit connected',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync today + last 3 days to catch any missed days
    const datesToSync: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      datesToSync.push(d.toISOString().split('T')[0]);
    }
    
    const results = [];

    // Sync each user
    for (const credential of credentials) {
      try {
        console.log(`Syncing user ${credential.user_id} for ${datesToSync.length} days...`);
        
        const userResults = [];
        for (const date of datesToSync) {
          try {
            const syncData = await syncUserData(supabaseAdmin, credential.user_id, date);
            userResults.push({ date, success: true, steps: syncData.steps });
          } catch (dateError) {
            console.error(`Error syncing ${date} for user ${credential.user_id}:`, dateError);
            userResults.push({ date, success: false });
          }
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Sync sleep data for same period
        for (const date of datesToSync) {
          await syncSleepData(supabaseAdmin, credential.user_id, date);
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`Sync successful for user ${credential.user_id}`);
        results.push({
          userId: credential.user_id,
          success: true,
          days: userResults
        });
      } catch (userError) {
        console.error(`Error syncing user ${credential.user_id}:`, userError);
        results.push({
          userId: credential.user_id,
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
        total: credentials.length,
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
    // Get credentials with Fitbit tokens
    const { data: credentials, error: credentialsError } = await supabaseClient
      .from('fitbit_credentials')
      .select('fitbit_user_id, access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .single();

    if (credentialsError || !credentials || !credentials.fitbit_user_id) {
      throw new Error('Fitbit not connected');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabaseClient, userId, credentials);

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
    const restingHeartRate = activityData.summary?.restingHeartRate || null;
    const activeMinutesLightly = activityData.summary?.lightlyActiveMinutes || null;
    const activeMinutesFairly = activityData.summary?.fairlyActiveMinutes || null;
    const activeMinutesVery = activityData.summary?.veryActiveMinutes || null;
    const distances = activityData.summary?.distances || [];
    const totalDistance = distances.find((d: any) => d.activity === 'total')?.distance || null;

    // Extract heart rate zones
    const heartRateZones = activityData.summary?.heartRateZones || [];
    const fatBurnZone = heartRateZones.find((z: any) => z.name === 'Fat Burn');
    const cardioZone = heartRateZones.find((z: any) => z.name === 'Cardio');
    const peakZone = heartRateZones.find((z: any) => z.name === 'Peak');
    const heartRateFatBurnMinutes = fatBurnZone?.minutes || null;
    const heartRateCardioMinutes = cardioZone?.minutes || null;
    const heartRatePeakMinutes = peakZone?.minutes || null;

    // Fetch weight and body fat data from Fitbit
    let weight = null;
    let bodyFat = null;
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
        if (weightData.weight && weightData.weight.length > 0) {
          weight = weightData.weight[0].weight;
          console.log(`Found weight data for user ${userId}: ${weight} kg`);
        }
      }

      // Fetch body fat data
      const fatResponse = await fetch(
        `https://api.fitbit.com/1/user/-/body/log/fat/date/${date}.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (fatResponse.ok) {
        const fatData = await fatResponse.json();
        if (fatData.fat && fatData.fat.length > 0) {
          bodyFat = fatData.fat[0].fat;
          console.log(`Found body fat data for user ${userId}: ${bodyFat}%`);
        }
      }
    } catch (bodyError) {
      console.error('Error fetching body data:', bodyError);
    }

    // Upsert daily log
    const { error: upsertError } = await supabaseClient
      .from('daily_logs')
      .upsert({
        user_id: userId,
        log_date: date,
        steps: steps,
        calorie_burn: caloriesOut,
        weight: weight,
        body_fat_percentage: bodyFat,
        resting_heart_rate: restingHeartRate,
        heart_rate_fat_burn_minutes: heartRateFatBurnMinutes,
        heart_rate_cardio_minutes: heartRateCardioMinutes,
        heart_rate_peak_minutes: heartRatePeakMinutes,
        active_minutes_lightly: activeMinutesLightly,
        active_minutes_fairly: activeMinutesFairly,
        active_minutes_very: activeMinutesVery,
        distance_km: totalDistance,
        synced_from_fitbit: true,
      }, {
        onConflict: 'user_id,log_date',
      });

    if (upsertError) {
      throw upsertError;
    }

    // Update last sync time
    await supabaseClient
      .from('fitbit_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId);

    // Log sync
    await supabaseClient
      .from('fitbit_sync_logs')
      .insert({
        user_id: userId,
        sync_date: date,
        status: 'success',
        message: `Auto-synced ${steps} steps, ${caloriesOut} calories${weight ? `, ${weight} kg` : ''}${bodyFat ? `, ${bodyFat}% fat` : ''}`,
      });

    return {
      steps,
      calories_out: caloriesOut,
      weight: weight,
      body_fat_percentage: bodyFat,
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

async function refreshTokenIfNeeded(supabaseClient: any, userId: string, credentials: any) {
  const expiresAt = new Date(credentials.token_expires_at);
  const accessToken = credentials.access_token;
  const refreshToken = credentials.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Fitbit tokens are missing. User needs to reconnect.');
  }

  // If token is still valid, return it
  if (expiresAt > new Date()) {
    return accessToken;
  }

  console.log('Token expired, refreshing for user:', userId);

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
      refresh_token: refreshToken,
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
    .from('fitbit_credentials')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
    })
    .eq('user_id', userId);

  return tokenData.access_token;
}

async function syncSleepData(supabaseClient: any, userId: string, date: string) {
  try {
    const { data: credentials } = await supabaseClient
      .from('fitbit_credentials')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .single();

    if (!credentials?.access_token) {
      return;
    }

    const accessToken = await refreshTokenIfNeeded(supabaseClient, userId, credentials);

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
