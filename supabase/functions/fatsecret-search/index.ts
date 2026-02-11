import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cache access token in memory (shared across requests in same isolate)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get('FATSECRET_CONSUMER_KEY');
  const clientSecret = Deno.env.get('FATSECRET_CONSUMER_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret credentials not configured');
  }

  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials&scope=premier',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('FatSecret token error:', errorText);
    throw new Error('Failed to get FatSecret access token');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, page = 0, food_id } = await req.json();

    const accessToken = await getAccessToken();

    // If food_id is provided, get detailed food info
    if (food_id) {
      const foodIdStr = String(food_id).replace(/[^0-9]/g, '');
      if (!foodIdStr) {
        return new Response(JSON.stringify({ error: 'Invalid food_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(
        `https://platform.fatsecret.com/rest/food/v4?food_id=${foodIdStr}&format=json&include_food_attributes=true`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FatSecret food.get error:', errorText);
        throw new Error(`FatSecret API error [${response.status}]`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search foods
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Search query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedQuery = query.trim().slice(0, 200);
    const pageNum = Math.max(0, Math.min(50, Number(page) || 0));

    const response = await fetch(
      `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=${encodeURIComponent(sanitizedQuery)}&page_number=${pageNum}&max_results=20&format=json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FatSecret search error:', errorText);
      throw new Error(`FatSecret API error [${response.status}]`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fatsecret-search:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
