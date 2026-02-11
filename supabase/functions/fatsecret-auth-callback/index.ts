import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function signOAuth1Request(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): Promise<string> {
  const encodedEntries = Object.entries(params).map(([k, v]) => [percentEncode(k), percentEncode(v)] as const);
  encodedEntries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const normalizedParams = encodedEntries.map(([k, v]) => `${k}=${v}`).join('&');
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(normalizedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const { oauth_token, oauth_verifier } = await req.json();

    if (!oauth_token || !oauth_verifier) {
      throw new Error('Missing oauth_token or oauth_verifier');
    }

    const consumerKey = Deno.env.get('FATSECRET_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('FATSECRET_CONSUMER_SECRET');
    if (!consumerKey || !consumerSecret) {
      throw new Error('FatSecret credentials not configured');
    }

    // Find stored request token secret
    const { data: stateRecords, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'fatsecret');

    if (stateError || !stateRecords?.length) {
      throw new Error('No pending FatSecret authorization found');
    }

    // Find matching state by oauth_token
    const matchingState = stateRecords.find(r => r.state.startsWith(oauth_token + ':'));
    if (!matchingState) {
      throw new Error('Invalid oauth_token - no matching state found');
    }

    const requestTokenSecret = matchingState.state.split(':')[1];

    // Step 3: Exchange for access token
    const accessTokenUrl = 'https://authentication.fatsecret.com/oauth/access_token';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_token: oauth_token,
      oauth_verifier: oauth_verifier,
    };

    // Send as POST with form-encoded body (consistent with request_token)
    const signature = await signOAuth1Request('POST', accessTokenUrl, oauthParams, consumerSecret, requestTokenSecret);

    const bodyParams = new URLSearchParams(oauthParams);
    bodyParams.set('oauth_signature', signature);

    const atResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    if (!atResponse.ok) {
      const errorText = await atResponse.text();
      console.error('Access token error:', errorText);
      throw new Error('Failed to get access token');
    }

    const atBody = await atResponse.text();
    const atParams = new URLSearchParams(atBody);
    const accessToken = atParams.get('oauth_token');
    const accessTokenSecret = atParams.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Invalid access token response');
    }

    // Store credentials using service role (to bypass RLS for upsert)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: upsertError } = await serviceClient
      .from('fatsecret_credentials')
      .upsert({
        user_id: userId,
        oauth_token: accessToken,
        oauth_secret: accessTokenSecret,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error storing credentials:', upsertError);
      throw upsertError;
    }

    // Clean up state records
    for (const record of stateRecords) {
      await supabase.from('oauth_states').delete().eq('id', record.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fatsecret-auth-callback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
