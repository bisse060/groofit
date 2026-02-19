import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Validate cron secret or service role
    const authHeader = req.headers.get("Authorization") || "";
    const { data: cronConfig } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      .from("app_config")
      .select("value")
      .eq("key", "cron_auth_secret")
      .single();

    const isValidCron = cronConfig?.value && authHeader === `Bearer ${cronConfig.value}`;
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    if (!isValidCron && !isServiceRole) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users who have been active in the last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysStr = fourteenDaysAgo.toISOString().split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

    // Get active users from daily_logs
    const { data: activeUsers } = await supabase
      .from("daily_logs")
      .select("user_id")
      .gte("log_date", fourteenDaysStr);

    const uniqueUserIds = [...new Set((activeUsers || []).map((u) => u.user_id))];
    console.log(`Generating weekly tips for ${uniqueUserIds.length} active users`);

    let successCount = 0;
    let errorCount = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Fetch user context
        const [profileRes, workoutsRes, sleepRes, logsRes] = await Promise.all([
          supabase.from("profiles").select("full_name, current_weight, target_weight, goals").eq("id", userId).single(),
          supabase.from("workouts").select("title, date").eq("user_id", userId).eq("is_template", false).gte("date", sevenDaysStr).order("date", { ascending: false }),
          supabase.from("sleep_logs").select("date, duration_minutes, efficiency, score").eq("user_id", userId).gte("date", sevenDaysStr).order("date", { ascending: false }),
          supabase.from("daily_logs").select("log_date, steps, calorie_intake, calorie_burn").eq("user_id", userId).gte("log_date", sevenDaysStr).order("log_date", { ascending: false }),
        ]);

        const profile = profileRes.data;
        const workouts = workoutsRes.data || [];
        const sleepLogs = sleepRes.data || [];
        const dailyLogs = logsRes.data || [];

        const systemContext = `Je bent een AI-coach in de Grofit fitness app. Genereer één korte, persoonlijke wekelijkse tip in het Nederlands. Maximaal 3 zinnen. Begin direct met de tip.

Gebruiker: ${profile?.full_name || "Gebruiker"}
Doelen: ${profile?.goals || "Niet ingevuld"}
Workouts deze week: ${workouts.length}
Gem. slaap: ${sleepLogs.length > 0 ? Math.round(sleepLogs.reduce((a, s) => a + (s.duration_minutes || 0), 0) / sleepLogs.length / 60 * 10) / 10 + "u" : "Geen data"}
Gem. stappen: ${dailyLogs.length > 0 ? Math.round(dailyLogs.reduce((a, l) => a + (l.steps || 0), 0) / dailyLogs.length) : 0}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemContext },
              { role: "user", content: "Geef mij een persoonlijke wekelijkse tip op basis van mijn data." },
            ],
          }),
        });

        if (!response.ok) {
          console.error(`AI error for user ${userId}:`, response.status);
          errorCount++;
          continue;
        }

        const result = await response.json();
        const tipContent = result.choices?.[0]?.message?.content;
        if (!tipContent) {
          errorCount++;
          continue;
        }

        await supabase.from("ai_coach_messages").insert({
          user_id: userId,
          role: "assistant",
          content: tipContent,
          metadata: { proactive: true, generated_at: new Date().toISOString() },
        });

        successCount++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (userError) {
        console.error(`Error generating tip for user ${userId}:`, userError);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: uniqueUserIds.length,
        successCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-coach-weekly-tips error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
