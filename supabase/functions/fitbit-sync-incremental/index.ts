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
    // Use service role for cron job access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting incremental sync job...');

    // Get all users with in_progress syncs
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

    // Process each user's sync (max 30 days per user per hour)
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
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} sync(s)`,
        results
      }),
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

async function processUserSync(supabaseAdmin: any, syncProgress: any) {
  const DAYS_PER_HOUR = 30;
  const userId = syncProgress.user_id;
  
  console.log(`Processing sync for user ${userId}: ${syncProgress.days_synced}/${syncProgress.total_days} days`);

  // Get user credentials with Fitbit tokens
  const { data: credentials, error: credentialsError } = await supabaseAdmin
    .from('fitbit_credentials')
    .select('fitbit_user_id, access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single();

  if (credentialsError || !credentials || !credentials.fitbit_user_id) {
    throw new Error('Fitbit not connected');
  }

  // Refresh token if needed
  let accessToken = await refreshTokenIfNeeded(supabaseAdmin, userId, credentials);

  let daysSyncedThisRun = 0;
  let successCount = 0;
  let failCount = 0;

  // Sync up to DAYS_PER_HOUR days
  const daysToSync = Math.min(DAYS_PER_HOUR, syncProgress.total_days - syncProgress.days_synced);

  for (let i = 0; i < daysToSync; i++) {
    const dayOffset = syncProgress.current_day_offset + i;
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Refresh token every 10 requests
      if (i > 0 && i % 10 === 0) {
        const { data: refreshCredentials } = await supabaseAdmin
          .from('fitbit_credentials')
          .select('access_token, refresh_token, token_expires_at')
          .eq('user_id', userId)
          .single();
        accessToken = await refreshTokenIfNeeded(supabaseAdmin, userId, refreshCredentials);
      }

      // Sync activity data
      await syncActivityData(supabaseAdmin, userId, accessToken, dateStr);
      
      // Small delay between endpoints
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Sync sleep data
      await syncSleepData(supabaseAdmin, userId, accessToken, dateStr);
      
      successCount++;
      console.log(`✓ Synced ${dateStr} for user ${userId}`);
      
      // Small delay between days
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`✗ Error syncing ${dateStr} for user ${userId}:`, error);
      failCount++;
    }
    
    daysSyncedThisRun++;
  }

  // Update sync progress
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

  // Update credentials last sync time
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

async function refreshTokenIfNeeded(supabaseClient: any, userId: string, credentials: any) {
  const expiresAt = new Date(credentials.token_expires_at);
  
  if (expiresAt > new Date(Date.now() + 300000)) { // 5 minutes buffer
    return credentials.access_token;
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
      refresh_token: credentials.refresh_token,
    }),
  });

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh token');
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

async function syncActivityData(supabaseClient: any, userId: string, accessToken: string, date: string) {
  const activityResponse = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!activityResponse.ok) {
    const errorText = await activityResponse.text();
    console.error(`Fitbit API error for ${date}: ${activityResponse.status} - ${errorText}`);
    throw new Error(`Failed to fetch activity data: ${activityResponse.status}`);
  }

  const activityData = await activityResponse.json();
  const steps = activityData.summary?.steps || 0;
  const caloriesOut = activityData.summary?.caloriesOut || 0;

  // Fetch weight and body fat
  let weight = null;
  let bodyFat = null;

  try {
    const weightResponse = await fetch(
      `https://api.fitbit.com/1/user/-/body/log/weight/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (weightResponse.ok) {
      const weightData = await weightResponse.json();
      if (weightData.weight && weightData.weight.length > 0) {
        weight = weightData.weight[0].weight;
      }
    }

    const fatResponse = await fetch(
      `https://api.fitbit.com/1/user/-/body/log/fat/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (fatResponse.ok) {
      const fatData = await fatResponse.json();
      if (fatData.fat && fatData.fat.length > 0) {
        bodyFat = fatData.fat[0].fat;
      }
    }
  } catch (error) {
    console.error('Error fetching body data:', error);
  }

  // Upsert daily log
  await supabaseClient
    .from('daily_logs')
    .upsert({
      user_id: userId,
      log_date: date,
      steps: steps,
      calorie_burn: caloriesOut,
      weight: weight,
      body_fat_percentage: bodyFat,
      synced_from_fitbit: true,
    }, {
      onConflict: 'user_id,log_date',
    });
}

async function syncSleepData(supabaseClient: any, userId: string, accessToken: string, date: string) {
  try {
    const fitbitResponse = await fetch(
      `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!fitbitResponse.ok) {
      return; // Skip if no sleep data
    }

    const data = await fitbitResponse.json();
    const mainLog = data.sleep?.[0];
    
    if (!mainLog) {
      return; // No sleep data for this date
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
  } catch (error) {
    console.error('Error syncing sleep data:', error);
  }
}
