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

    const { code, state, redirectUrl } = await req.json();
    
    // Validate state
    const { data: stateRecord, error: stateError } = await supabaseClient
      .from('oauth_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'fitbit')
      .eq('state', state)
      .single();

    if (stateError || !stateRecord) {
      throw new Error('Invalid state token');
    }

    // Exchange code for tokens
    const clientId = Deno.env.get('FITBIT_CLIENT_ID');
    const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Fitbit credentials not configured');
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Fitbit token error:', errorText);
      throw new Error('Failed to get Fitbit tokens');
    }

    const tokenData = await tokenResponse.json();
    
    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Store credentials directly (RLS protects the table)
    const { error: updateError } = await supabaseClient
      .from('fitbit_credentials')
      .upsert({
        user_id: user.id,
        fitbit_user_id: tokenData.user_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        scope: tokenData.scope,
        connected_at: new Date().toISOString(),
        last_sync_at: null,
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    // Clean up state record
    await supabaseClient
      .from('oauth_states')
      .delete()
      .eq('id', stateRecord.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fitbit-auth-callback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
