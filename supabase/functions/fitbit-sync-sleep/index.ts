import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FITBIT_CLIENT_ID = Deno.env.get('FITBIT_CLIENT_ID')!;
const FITBIT_CLIENT_SECRET = Deno.env.get('FITBIT_CLIENT_SECRET')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Payload {
  userId: string;
  date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, date }: Payload = await req.json();

    if (!userId || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing sleep data for user ${userId} on ${date}`);

    // 1: Fetch user credentials
    const { data: credentials, error: credentialsError } = await supabaseAdmin
      .from('fitbit_credentials')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .single();

    if (credentialsError || !credentials?.access_token) {
      console.error('Credentials error:', credentialsError);
      return new Response(
        JSON.stringify({ error: 'Fitbit not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = credentials.access_token;
    let refreshToken = credentials.refresh_token;

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Fitbit tokens missing. User needs to reconnect.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const expiresAt = credentials.token_expires_at
      ? new Date(credentials.token_expires_at)
      : null;

    // Refresh token if needed
    const now = new Date();
    if (!expiresAt || expiresAt.getTime() - now.getTime() < 60 * 1000) {
      console.log('Refreshing Fitbit token...');
      const basicAuth = btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`);

      const tokenResp = await fetch('https://api.fitbit.com/oauth2/token', {
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

      if (!tokenResp.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenJson = await tokenResp.json();
      accessToken = tokenJson.access_token;

      const newExpiresAt = new Date(now.getTime() + tokenJson.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from('fitbit_credentials')
        .update({
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? refreshToken,
          token_expires_at: newExpiresAt,
          last_sync_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    // 3: Fetch sleep data from Fitbit
    const sleepResp = await fetch(
      `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!sleepResp.ok) {
      const errorText = await sleepResp.text();
      console.error('Fitbit API error:', errorText);
      throw new Error(`Fitbit API error: ${sleepResp.status}`);
    }

    const sleepJson = await sleepResp.json();
    const sleep = Array.isArray(sleepJson.sleep) ? sleepJson.sleep[0] : null;

    if (!sleep) {
      console.log('No sleep data for this date');
      await supabaseAdmin
        .from('sleep_logs')
        .upsert(
          { user_id: userId, date, raw: sleepJson },
          { onConflict: 'user_id,date' }
        );
      
      return new Response(
        JSON.stringify({ success: true, noData: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = sleep.duration ? Math.round(sleep.duration / 60000) : null;
    const summary = sleep.levels?.summary ?? {};

    await supabaseAdmin
      .from('sleep_logs')
      .upsert(
        {
          user_id: userId,
          date,
          duration_minutes: duration,
          efficiency: sleep.efficiency ?? null,
          score: sleep.efficiency ?? null,
          deep_minutes: summary.deep?.minutes ?? 0,
          rem_minutes: summary.rem?.minutes ?? 0,
          light_minutes: summary.light?.minutes ?? 0,
          wake_minutes: summary.wake?.minutes ?? 0,
          start_time: sleep.startTime ?? null,
          end_time: sleep.endTime ?? null,
          raw: sleepJson,
        },
        { onConflict: 'user_id,date' }
      );

    console.log('Sleep data synced successfully');

    return new Response(
      JSON.stringify({
        success: true,
        duration_minutes: duration,
        score: sleep.efficiency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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