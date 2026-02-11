import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshTokenIfNeeded(supabaseClient: any, userId: string, credentials: any) {
  const expiresAt = new Date(credentials.token_expires_at);
  
  // Try to decrypt the access token, fallback to using it directly if decryption fails
  let accessToken = credentials.access_token;
  try {
    const { data: decryptedAccessToken } = await supabaseClient.rpc('decrypt_token', { 
      encrypted_token: credentials.access_token 
    });
    if (decryptedAccessToken) {
      accessToken = decryptedAccessToken;
    }
  } catch (error) {
    console.log('Failed to decrypt access token, using stored value directly');
  }

  // If token is still valid, return it
  if (expiresAt > new Date()) {
    return accessToken;
  }

  console.log('Token expired, refreshing...');
  
  // Try to decrypt refresh token, fallback to using it directly
  let refreshToken = credentials.refresh_token;
  try {
    const { data: decryptedRefreshToken } = await supabaseClient.rpc('decrypt_token', { 
      encrypted_token: credentials.refresh_token 
    });
    if (decryptedRefreshToken) {
      refreshToken = decryptedRefreshToken;
    }
  } catch (error) {
    console.log('Failed to decrypt refresh token, using stored value directly');
  }

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

  // Encrypt new tokens before storing
  const { data: encryptedAccessToken } = await supabaseClient.rpc('encrypt_token', { 
    token: tokenData.access_token 
  });
  const { data: encryptedRefreshToken } = await supabaseClient.rpc('encrypt_token', { 
    token: tokenData.refresh_token 
  });

  await supabaseClient
    .from('fitbit_credentials')
    .update({
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: newExpiresAt.toISOString(),
    })
    .eq('user_id', userId);

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

    // Get credentials with Fitbit tokens
    const { data: credentials, error: credentialsError } = await supabaseClient
      .from('fitbit_credentials')
      .select('fitbit_user_id, access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (credentialsError || !credentials || !credentials.fitbit_user_id) {
      throw new Error('Fitbit not connected');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabaseClient, user.id, credentials);

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
        // Get the most recent weight log for this date
        if (weightData.weight && weightData.weight.length > 0) {
          weight = weightData.weight[0].weight;
          console.log(`Found weight data: ${weight} kg`);
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
          console.log(`Found body fat data: ${bodyFat}%`);
        }
      }
    } catch (bodyError) {
      console.error('Error fetching body data:', bodyError);
      // Continue even if body data fetch fails
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
      console.error('Error upserting daily log:', upsertError);
      throw upsertError;
    }

    // Update last sync time
    await supabaseClient
      .from('fitbit_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', user.id);

    // Log sync
    await supabaseClient
      .from('fitbit_sync_logs')
      .insert({
        user_id: user.id,
        sync_date: date,
        status: 'success',
        message: `Synced ${steps} steps, ${caloriesOut} cal${restingHeartRate ? `, ${restingHeartRate} bpm` : ''}${weight ? `, ${weight} kg` : ''}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        date: date,
        steps: steps,
        calories_out: caloriesOut,
        resting_heart_rate: restingHeartRate,
        weight: weight,
        body_fat_percentage: bodyFat,
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
