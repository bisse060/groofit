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

    const { days = 365 } = await req.json();

    console.log(`Starting historical sync for ${days} days for user ${user.id}`);
    
    // Start background sync and return immediately
    const syncPromise = performHistoricalSync(supabaseClient, user.id, days);
    
    // Use waitUntil to keep function running for background task
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(syncPromise);
    }

    // Return immediately to user
    return new Response(
      JSON.stringify({
        success: true,
        message: `Historical sync started for ${days} days. This will run in the background and may take some time.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-sync-historical:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function performHistoricalSync(supabaseClient: any, userId: string, totalDays: number) {
  const BATCH_SIZE = 30; // Process 30 days at a time to avoid rate limits
  const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches
  
  try {

    // Get profile with Fitbit tokens
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('fitbit_user_id, fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.fitbit_user_id) {
      console.error('Fitbit not connected for user', userId);
      return;
    }

    console.log(`Processing ${totalDays} days in batches of ${BATCH_SIZE}`);
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    // Process in batches
    for (let batchStart = 0; batchStart < totalDays; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalDays);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalDays / BATCH_SIZE);
      
      console.log(`Starting batch ${batchNum}/${totalBatches} (days ${batchStart}-${batchEnd-1})`);
      
      // Get fresh token for this batch
      const { data: currentProfile } = await supabaseClient
        .from('profiles')
        .select('fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
        .eq('id', userId)
        .single();
      
      let accessToken = await refreshTokenIfNeeded(supabaseClient, userId, currentProfile);
      
      // Sync each day in this batch
      for (let i = batchStart; i < batchEnd; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        try {
          // Refresh token every 10 requests within batch
          if ((i - batchStart) % 10 === 0 && i !== batchStart) {
            const { data: refreshProfile } = await supabaseClient
              .from('profiles')
              .select('fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
              .eq('id', userId)
              .single();
            accessToken = await refreshTokenIfNeeded(supabaseClient, userId, refreshProfile);
          }

          // Sync activity data
          await syncActivityData(supabaseClient, userId, accessToken, dateStr);
          
          // Small delay between endpoints
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Sync sleep data
          await syncSleepData(supabaseClient, userId, accessToken, dateStr);
          
          totalSuccessful++;
          console.log(`✓ Synced ${dateStr} (${i + 1}/${totalDays})`);
          
          // Small delay between days
          await new Promise(resolve => setTimeout(resolve, 600));
        } catch (error) {
          console.error(`✗ Error syncing ${dateStr}:`, error);
          totalFailed++;
        }
      }
      
      // Longer delay between batches (except for last batch)
      if (batchEnd < totalDays) {
        console.log(`Batch ${batchNum} complete. Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Update last sync time
    await supabaseClient
      .from('profiles')
      .update({ fitbit_last_sync_at: new Date().toISOString() })
      .eq('id', userId);

    console.log(`Historical sync complete: ${totalSuccessful} successful, ${totalFailed} failed`);
  } catch (error) {
    console.error('Fatal error in performHistoricalSync:', error);
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
    throw new Error('Failed to refresh token');
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

async function syncActivityData(supabaseClient: any, userId: string, accessToken: string, date: string) {
  // Fetch activity data
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
