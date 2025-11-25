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

    console.log(`Starting historical sync setup for ${days} days for user ${user.id}`);

    // Get profile with Fitbit tokens
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('fitbit_user_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.fitbit_user_id) {
      throw new Error('Fitbit not connected');
    }

    // Check if there's already an active sync
    const { data: existingSync } = await supabaseClient
      .from('fitbit_sync_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingSync && existingSync.status === 'in_progress') {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Sync already in progress: ${existingSync.days_synced}/${existingSync.total_days} days synced`,
          progress: existingSync
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update sync progress record
    const { error: upsertError } = await supabaseClient
      .from('fitbit_sync_progress')
      .upsert({
        user_id: user.id,
        total_days: days,
        days_synced: 0,
        current_day_offset: 0,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        error_message: null,
        completed_at: null,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Historical sync initiated! Data will be synced over the next 24 hours at a rate of 30 days per hour. Total: ${days} days`,
        estimatedCompletionHours: Math.ceil(days / 30),
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
