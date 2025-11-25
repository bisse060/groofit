import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { date } = await req.json();
    if (!date) {
      throw new Error('Date is required');
    }

    console.log(`Syncing sleep data for user ${user.id} on ${date}`);

    // Get user profile with Fitbit tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fitbit_access_token, fitbit_refresh_token, fitbit_token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.fitbit_access_token) {
      throw new Error('Fitbit not connected');
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, user.id, profile);

    // Fetch sleep data from Fitbit
    const fitbitUrl = `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`;
    const fitbitResponse = await fetch(fitbitUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fitbitResponse.ok) {
      const errorText = await fitbitResponse.text();
      console.error('Fitbit API error:', errorText);
      throw new Error(`Fitbit API error: ${fitbitResponse.status}`);
    }

    const data = await fitbitResponse.json();
    console.log('Fitbit sleep response:', JSON.stringify(data));

    // Get main sleep log
    const mainLog = data.sleep?.[0];
    
    if (!mainLog) {
      console.log('No sleep data for this date');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No sleep data available for this date',
          hasData: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse sleep data
    const sleepData = {
      user_id: user.id,
      date,
      duration_minutes: Math.floor(mainLog.duration / 60000),
      efficiency: mainLog.efficiency || null,
      score: mainLog.efficiency || null, // Fitbit free doesn't have sleep score, using efficiency
      deep_minutes: mainLog.levels?.summary?.deep?.minutes || 0,
      rem_minutes: mainLog.levels?.summary?.rem?.minutes || 0,
      light_minutes: mainLog.levels?.summary?.light?.minutes || 0,
      wake_minutes: mainLog.levels?.summary?.wake?.minutes || 0,
      start_time: mainLog.startTime,
      end_time: mainLog.endTime,
      raw: data,
    };

    // Upsert sleep log
    const { error: upsertError } = await supabase
      .from('sleep_logs')
      .upsert(sleepData, { onConflict: 'user_id,date' });

    if (upsertError) {
      console.error('Error upserting sleep data:', upsertError);
      throw upsertError;
    }

    console.log('Sleep data synced successfully');

    return new Response(
      JSON.stringify({
        success: true,
        hasData: true,
        score: sleepData.score,
        duration_minutes: sleepData.duration_minutes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fitbit-sync-sleep:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function refreshTokenIfNeeded(
  supabaseClient: any,
  userId: string,
  profile: any
): Promise<string> {
  const expiresAt = new Date(profile.fitbit_token_expires_at);
  const now = new Date();

  if (expiresAt > now) {
    return profile.fitbit_access_token;
  }

  console.log('Refreshing Fitbit token...');

  const clientId = Deno.env.get('FITBIT_CLIENT_ID')!;
  const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET')!;
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: profile.fitbit_refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabaseClient
    .from('profiles')
    .update({
      fitbit_access_token: tokens.access_token,
      fitbit_refresh_token: tokens.refresh_token,
      fitbit_token_expires_at: newExpiresAt.toISOString(),
    })
    .eq('id', userId);

  return tokens.access_token;
}