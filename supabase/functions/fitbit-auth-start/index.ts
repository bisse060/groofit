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
    console.log('fitbit-auth-start: Request received');
    
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
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }

    const { redirectUrl } = await req.json();

    // Validate redirectUrl against allowed domains
    const allowedOrigins = [
      Deno.env.get('SUPABASE_URL'),
      'https://groofit.lovable.app',
      'http://localhost:',
      'https://id-preview--',
    ];
    if (!redirectUrl || !allowedOrigins.some(origin => origin && redirectUrl.startsWith(origin))) {
      return new Response(
        JSON.stringify({ error: 'Invalid redirect URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Redirect URL received:', redirectUrl);
    
    const clientId = Deno.env.get('FITBIT_CLIENT_ID');
    if (!clientId) {
      console.error('FITBIT_CLIENT_ID not configured');
      throw new Error('FITBIT_CLIENT_ID not configured');
    }
    
    console.log('Using Client ID:', clientId.substring(0, 8) + '...');

    // Generate state token
    const state = crypto.randomUUID();
    
    // Store state in database
    const { error: stateError } = await supabaseClient
      .from('oauth_states')
      .insert({
        user_id: user.id,
        provider: 'fitbit',
        state: state,
      });

    if (stateError) {
      console.error('Error storing state:', stateError);
      throw stateError;
    }

    // Build Fitbit OAuth URL
    const scope = 'activity nutrition profile settings weight heartrate sleep';
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scope)}&state=${state}`;
    
    console.log('Generated auth URL (state hidden):', authUrl.replace(state, 'STATE_HIDDEN'));

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-auth-start:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
