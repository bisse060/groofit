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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting incremental sync job...');

    const { data: syncProgressRecords, error: progressError } = await supabaseAdmin
      .from('fitbit_sync_progress')
      .select('*')
      .eq('status', 'in_progress')
      .order('last_sync_at', { ascending: true });

    if (progressError) {
      console.error('Error fetching sync progress:', progressError);
      throw progressError;
    }

    if (!syncProgressRecords || syncProgressRecords.length === 0) {
      console.log('No active syncs found');
      return new Response(
        JSON.stringify({ message: 'No active syncs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${syncProgressRecords.length} active sync(s)`);

    const results = [];

    for (const syncProgress of syncProgressRecords) {
      try {
        const result = await processUserSync(supabaseAdmin, syncProgress);
        results.push(result);
      } catch (error) {
        console.error(`Error processing sync for user ${syncProgress.user_id}:`, error);
        results.push({
          userId: syncProgress.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Processed ${results.length} sync(s)`, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-sync-incremental:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fitbit allows 150 API calls/hour. Each day uses ~3 calls (activity + weight/fat + sleep).
// So max ~50 days per hour to stay safe.
const DAYS_PER_RUN = 20;

async function processUserSync(supabaseAdmin: any, syncProgress: any) {
  const userId = syncProgress.user_id;
  
  console.log(`Processing sync for user ${userId}: ${syncProgress.days_synced}/${syncProgress.total_days} days`);

  const { data: credentials, error: credentialsError } = await supabaseAdmin
    .from('fitbit_credentials')
    .select('fitbit_user_id, access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single();

  if (credentialsError || !credentials || !credentials.fitbit_user_id) {
    throw new Error('Fitbit not connected');
  }

  // Use tokens directly (no encryption)
  let accessToken = credentials.access_token;
  const refreshToken = credentials.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Fitbit tokens are missing. User needs to reconnect.');
  }

  // Refresh token if needed
  accessToken = await refreshTokenIfNeeded(supabaseAdmin, userId, accessToken, refreshToken, credentials.token_expires_at);

  let daysSyncedThisRun = 0;
  let successCount = 0;
  let failCount = 0;

  const daysToSync = Math.min(DAYS_PER_RUN, syncProgress.total_days - syncProgress.days_synced);

  for (let i = 0; i < daysToSync; i++) {
    const dayOffset = syncProgress.current_day_offset + i;
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Refresh token every 15 requests to stay safe
      if (i > 0 && i % 15 === 0) {
        const { data: freshCreds } = await supabaseAdmin
          .from('fitbit_credentials')
          .select('access_token, refresh_token, token_expires_at')
          .eq('user_id', userId)
          .single();
        if (freshCreds) {
          accessToken = await refreshTokenIfNeeded(supabaseAdmin, userId, freshCreds.access_token, freshCreds.refresh_token, freshCreds.token_expires_at);
        }
      }

      await syncActivityData(supabaseAdmin, userId, accessToken, dateStr);
      await new Promise(resolve => setTimeout(resolve, 200));
      await syncSleepData(supabaseAdmin, userId, accessToken, dateStr);
      
      successCount++;
      console.log(`✓ Synced ${dateStr} for user ${userId}`);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`✗ Error syncing ${dateStr} for user ${userId}:`, error);
      failCount++;
      
      // If we get a 429 (rate limit), stop this run
      if (error instanceof Error && error.message.includes('429')) {
        console.log('Rate limited, stopping this run');
        break;
      }
    }
    
    daysSyncedThisRun++;
  }

  const newDaysSynced = syncProgress.days_synced + daysSyncedThisRun;
  const newDayOffset = syncProgress.current_day_offset + daysSyncedThisRun;
  const isComplete = newDaysSynced >= syncProgress.total_days;

  await supabaseAdmin
    .from('fitbit_sync_progress')
    .update({
      days_synced: newDaysSynced,
      current_day_offset: newDayOffset,
      status: isComplete ? 'completed' : 'in_progress',
      last_sync_at: new Date().toISOString(),
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq('user_id', userId);

  if (successCount > 0) {
    await supabaseAdmin
      .from('fitbit_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  return {
    userId,
    success: true,
    daysSynced: daysSyncedThisRun,
    successCount,
    failCount,
    totalProgress: `${newDaysSynced}/${syncProgress.total_days}`,
    completed: isComplete
  };
}

async function refreshTokenIfNeeded(
  supabaseClient: any, userId: string,
  accessToken: string, refreshToken: string, tokenExpiresAt: string
) {
  const expiresAt = new Date(tokenExpiresAt);
  
  // If token is still valid (with 5 minute buffer), return it
  if (expiresAt > new Date(Date.now() + 300000)) {
    return accessToken;
  }

  console.log('Token expired, refreshing...');
  
  const clientId = Deno.env.get('FITBIT_CLIENT_ID');
  const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing FITBIT_CLIENT_ID or FITBIT_CLIENT_SECRET');
  }

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
    console.error(`Fitbit token refresh failed: ${refreshResponse.status} - ${errorText}`);
    
    if (refreshResponse.status === 401 || refreshResponse.status === 400) {
      await supabaseClient
        .from('fitbit_sync_progress')
        .update({
          status: 'error',
          error_message: 'Fitbit verbinding verlopen. Verbind opnieuw via je profiel.',
        })
        .eq('user_id', userId);
    }
    
    throw new Error(`Failed to refresh token: ${refreshResponse.status}`);
  }

  const tokenData = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Store new tokens directly
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

async function syncActivityData(supabaseClient: any, userId: string, accessToken: string, date: string) {
  const activityResponse = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!activityResponse.ok) {
    const errorText = await activityResponse.text();
    console.error(`Fitbit API error for ${date}: ${activityResponse.status} - ${errorText}`);
    throw new Error(`Failed to fetch activity data: ${activityResponse.status}`);
  }

  const activityData = await activityResponse.json();
  const summary = activityData.summary || {};
  const distances = summary.distances || [];
  const heartRateZones = summary.heartRateZones || [];

  // Fetch weight and body fat
  let weight = null;
  let bodyFat = null;

  try {
    const [weightRes, fatRes] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/body/log/weight/date/${date}.json`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }),
      fetch(`https://api.fitbit.com/1/user/-/body/log/fat/date/${date}.json`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }),
    ]);

    if (weightRes.ok) {
      const weightData = await weightRes.json();
      if (weightData.weight?.[0]) weight = weightData.weight[0].weight;
    }
    if (fatRes.ok) {
      const fatData = await fatRes.json();
      if (fatData.fat?.[0]) bodyFat = fatData.fat[0].fat;
    }
  } catch (error) {
    console.error('Error fetching body data:', error);
  }

  await supabaseClient
    .from('daily_logs')
    .upsert({
      user_id: userId,
      log_date: date,
      steps: summary.steps || 0,
      calorie_burn: summary.caloriesOut || 0,
      weight,
      body_fat_percentage: bodyFat,
      resting_heart_rate: summary.restingHeartRate || null,
      heart_rate_fat_burn_minutes: heartRateZones.find((z: any) => z.name === 'Fat Burn')?.minutes || null,
      heart_rate_cardio_minutes: heartRateZones.find((z: any) => z.name === 'Cardio')?.minutes || null,
      heart_rate_peak_minutes: heartRateZones.find((z: any) => z.name === 'Peak')?.minutes || null,
      active_minutes_lightly: summary.lightlyActiveMinutes || null,
      active_minutes_fairly: summary.fairlyActiveMinutes || null,
      active_minutes_very: summary.veryActiveMinutes || null,
      distance_km: distances.find((d: any) => d.activity === 'total')?.distance || null,
      synced_from_fitbit: true,
    }, { onConflict: 'user_id,log_date' });
}

async function syncSleepData(supabaseClient: any, userId: string, accessToken: string, date: string) {
  try {
    const fitbitResponse = await fetch(
      `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!fitbitResponse.ok) return;

    const data = await fitbitResponse.json();
    const mainLog = data.sleep?.[0];
    if (!mainLog) return;

    await supabaseClient
      .from('sleep_logs')
      .upsert({
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
      }, { onConflict: 'user_id,date' });
  } catch (error) {
    console.error('Error syncing sleep data:', error);
  }
}
