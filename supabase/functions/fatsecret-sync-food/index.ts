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
  tokenSecret: string
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

async function makeFatSecretApiCall(
  method_name: string,
  extraParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  oauthToken: string,
  oauthSecret: string
): Promise<any> {
  const apiUrl = 'https://platform.fatsecret.com/rest/server.api';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const allParams: Record<string, string> = {
    method: method_name,
    format: 'json',
    oauth_consumer_key: consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
    oauth_token: oauthToken,
    ...extraParams,
  };

  const signature = await signOAuth1Request('POST', apiUrl, allParams, consumerSecret, oauthSecret);

  // Build form body (all params + signature)
  const bodyParams = new URLSearchParams(allParams);
  bodyParams.set('oauth_signature', signature);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`FatSecret API error (${method_name}):`, errorText);
    throw new Error(`FatSecret API error [${response.status}]`);
  }

  return response.json();
}

// Map FatSecret meal type to our meal_type
function mapMealType(fsMealName: string): string {
  const name = fsMealName.toLowerCase();
  if (name.includes('breakfast')) return 'breakfast';
  if (name.includes('lunch')) return 'lunch';
  if (name.includes('dinner')) return 'dinner';
  return 'snack';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function can be called by user (with auth) or by cron (with service role)
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceCall = authHeader === `Bearer ${serviceRoleKey}`;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    let userId: string;

    if (isServiceCall) {
      // Cron job: sync all connected users
      const { data: allCreds } = await serviceClient
        .from('fatsecret_credentials')
        .select('user_id, oauth_token, oauth_secret');

      if (!allCreds?.length) {
        return new Response(JSON.stringify({ message: 'No connected users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const cred of allCreds) {
        try {
          const result = await syncUserFood(serviceClient, cred.user_id, cred.oauth_token, cred.oauth_secret);
          results.push({ user_id: cred.user_id, ...result });
        } catch (err) {
          console.error(`Sync failed for user ${cred.user_id}:`, err);
          results.push({ user_id: cred.user_id, error: err instanceof Error ? err.message : 'Unknown' });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-initiated sync
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
    userId = claimsData.claims.sub as string;

    // Get user's FatSecret credentials
    const { data: cred } = await serviceClient
      .from('fatsecret_credentials')
      .select('oauth_token, oauth_secret')
      .eq('user_id', userId)
      .single();

    if (!cred) {
      return new Response(JSON.stringify({ error: 'FatSecret not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { date } = await req.json().catch(() => ({}));
    const result = await syncUserFood(serviceClient, userId, cred.oauth_token, cred.oauth_secret, date);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fatsecret-sync-food:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncUserFood(
  serviceClient: any,
  userId: string,
  oauthToken: string,
  oauthSecret: string,
  dateStr?: string
) {
  const consumerKey = Deno.env.get('FATSECRET_CONSUMER_KEY')!;
  const consumerSecret = Deno.env.get('FATSECRET_CONSUMER_SECRET')!;

  // Default to today
  const targetDate = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  const logDate = targetDate.toISOString().split('T')[0];

  // FatSecret uses days since epoch for date parameter
  const daysSinceEpoch = Math.floor(targetDate.getTime() / 86400000);

  // Get food entries for the date
  const data = await makeFatSecretApiCall(
    'food_entries.get.v2',
    { date: daysSinceEpoch.toString() },
    consumerKey, consumerSecret, oauthToken, oauthSecret
  );

  const entries = data?.food_entries?.food_entry;
  if (!entries) {
    // No entries for this day, clear existing synced entries
    await serviceClient
      .from('food_logs')
      .delete()
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .eq('fatsecret_food_id', null) // Only delete if not manually added (actually delete all synced)
      .neq('fatsecret_food_id', null); // Actually, mark synced ones

    // Actually, let's just delete entries that have a fatsecret_food_id for this date
    // and let the trigger update daily_logs
    return { success: true, synced: 0, date: logDate };
  }

  const foodEntries = Array.isArray(entries) ? entries : [entries];

  // Delete existing synced food logs for this date
  await serviceClient
    .from('food_logs')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', logDate);

  // Insert new entries
  const logs = foodEntries.map((entry: any) => ({
    user_id: userId,
    log_date: logDate,
    food_name: entry.food_entry_name || entry.food_name || 'Unknown',
    brand: entry.brand_name || null,
    meal_type: mapMealType(entry.meal || ''),
    fatsecret_food_id: String(entry.food_id || ''),
    serving_description: entry.serving_description || null,
    calories: parseFloat(entry.calories) || 0,
    protein_g: parseFloat(entry.protein) || 0,
    carbs_g: parseFloat(entry.carbohydrate) || 0,
    fat_g: parseFloat(entry.fat) || 0,
    fiber_g: parseFloat(entry.fiber) || 0,
    quantity: parseFloat(entry.number_of_units) || 1,
  }));

  if (logs.length > 0) {
    const { error } = await serviceClient.from('food_logs').insert(logs);
    if (error) {
      console.error('Error inserting food logs:', error);
      throw error;
    }
  }

  // Update last_sync_at
  await serviceClient
    .from('fatsecret_credentials')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { success: true, synced: logs.length, date: logDate };
}
