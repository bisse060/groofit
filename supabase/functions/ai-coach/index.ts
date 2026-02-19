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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create authenticated client to get user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for data fetching
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action, messages: chatMessages, routineName, routineDescription } = body;

    // --- Build user context ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

    const [profileRes, workoutsRes, measurementsRes, sleepRes, logsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, current_weight, target_weight, height_cm, goals, coach_instructions").eq("id", user.id).single(),
      supabase.from("workouts").select("title, date, notes, workout_exercises(exercise_id, notes, workout_sets(set_number, weight, reps, rir))").eq("user_id", user.id).eq("is_template", false).gte("date", sevenDaysStr).order("date", { ascending: false }),
      supabase.from("measurements").select("measurement_date, weight, chest_cm, waist_cm, hips_cm, bicep_left_cm, bicep_right_cm").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(3),
      supabase.from("sleep_logs").select("date, duration_minutes, efficiency, score, deep_minutes, rem_minutes, light_minutes, wake_minutes").eq("user_id", user.id).gte("date", sevenDaysStr).order("date", { ascending: false }),
      supabase.from("daily_logs").select("log_date, steps, calorie_intake, calorie_burn, active_minutes_lightly, active_minutes_fairly, active_minutes_very, resting_heart_rate").eq("user_id", user.id).gte("log_date", sevenDaysStr).order("log_date", { ascending: false }),
    ]);

    const profile = profileRes.data;
    const workouts = workoutsRes.data || [];
    const measurements = measurementsRes.data || [];
    const sleepLogs = sleepRes.data || [];
    const dailyLogs = logsRes.data || [];

    const systemContext = `Je bent een persoonlijke AI-coach in de Grofit fitness app. Je bent vriendelijk, motiverend en to-the-point. Je geeft praktisch advies gebaseerd op de data van de gebruiker. Antwoord altijd in het Nederlands.

BELANGRIJK: Als de gebruiker vraagt om een trainingschema, een routine, een trainingsplan of iets vergelijkbaars, beschrijf dan kort wat voor schema je zou aanbevelen (push/pull/legs, full body, etc.) maar zeg ALTIJD aan het einde: "Klik op de knop 'Schema aanmaken' die nu is verschenen om het schema daadwerkelijk op te slaan in de app." Maak nooit een schema alleen via tekst - de app heeft een speciale functie hiervoor die automatisch opent.

## Gebruikersprofiel
Naam: ${profile?.full_name || "Onbekend"}
Gewicht: ${profile?.current_weight ? profile.current_weight + " kg" : "Niet ingevuld"}
Streefgewicht: ${profile?.target_weight ? profile.target_weight + " kg" : "Niet ingevuld"}
Lengte: ${profile?.height_cm ? profile.height_cm + " cm" : "Niet ingevuld"}
Doelen: ${profile?.goals || "Niet ingevuld"}
${profile?.coach_instructions ? `\n## Persoonlijke instructies van de gebruiker (ALTIJD opvolgen)\n${profile.coach_instructions}` : ""}

## Trainingen afgelopen 7 dagen (${workouts.length} workouts)
${workouts.length === 0 ? "Geen trainingen geregistreerd." : workouts.map(w => `- ${w.date}: ${w.title || "Workout"} (${Array.isArray(w.workout_exercises) ? w.workout_exercises.length : 0} oefeningen)`).join("\n")}

## Laatste 3 metingen
${measurements.length === 0 ? "Geen metingen beschikbaar." : measurements.map(m => `- ${m.measurement_date}: gewicht ${m.weight || "?"} kg, taille ${m.waist_cm || "?"} cm, borst ${m.chest_cm || "?"} cm`).join("\n")}

## Slaap afgelopen 7 dagen
${sleepLogs.length === 0 ? "Geen slaapdata beschikbaar." : sleepLogs.map(s => `- ${s.date}: ${Math.round((s.duration_minutes || 0) / 60 * 10) / 10}u slaap, efficiëntie ${s.efficiency || "?"}%, score ${s.score || "?"}`).join("\n")}

## Dagelijkse logs afgelopen 7 dagen
${dailyLogs.length === 0 ? "Geen dagelijkse logs beschikbaar." : dailyLogs.map(l => `- ${l.log_date}: ${l.steps || 0} stappen, ${l.calorie_intake || 0} kcal intake, ${l.calorie_burn || 0} kcal verbrand`).join("\n")}

Gebruik deze data om gepersonaliseerde antwoorden te geven. Als data ontbreekt, geef dan algemeen advies.`;

    // =====================
    // ACTION: chat (streaming)
    // =====================
    if (action === "chat") {
      const messages = [
        { role: "system", content: systemContext },
        ...(chatMessages || []),
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Onvoldoende credits, voeg credits toe aan je workspace." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway fout" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // =====================
    // ACTION: generate-routine (tool calling)
    // =====================
    if (action === "generate-routine") {
      // Fetch user's exercises
      const { data: exercises } = await supabase
        .from("exercises")
        .select("id, name, body_part, equipment, primary_muscles")
        .eq("user_id", user.id)
        .limit(100);

      const exerciseList = exercises || [];
      const exerciseContext = exerciseList.length > 0
        ? `\n\n## Beschikbare oefeningen van de gebruiker (gebruik deze IDs)\n${exerciseList.map(e => `- ID: ${e.id} | Naam: ${e.name} | Spiergroep: ${e.body_part || "?"} | Equipment: ${e.equipment || "?"}`).join("\n")}`
        : "\n\n## Beschikbare oefeningen\nGeen oefeningen gevonden. Gebruik algemene oefeningen maar sla dan geen workout_exercise_id op.";

      const routinePrompt = `De gebruiker vraagt om een trainingschema: "${routineName || "Trainingschema"}"${routineDescription ? ` - ${routineDescription}` : ""}. 
      
Maak een compleet trainingschema aan via de create_routine tool. Gebruik oefening-IDs uit de beschikbare lijst. Als een oefening niet beschikbaar is, sla die dan over. Maak 3-5 oefeningen per schema met elk 3-4 sets.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemContext + exerciseContext },
            { role: "user", content: routinePrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_routine",
                description: "Maakt een trainingschema aan met oefeningen en sets",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Naam van het trainingschema" },
                    notes: { type: "string", description: "Beschrijving of uitleg van het schema" },
                    exercises: {
                      type: "array",
                      description: "Lijst van oefeningen in het schema",
                      items: {
                        type: "object",
                        properties: {
                          exercise_id: { type: "string", description: "UUID van de oefening uit de beschikbare lijst" },
                          exercise_name: { type: "string", description: "Naam van de oefening (voor weergave)" },
                          order_index: { type: "number", description: "Volgorde in het schema (0-based)" },
                          notes: { type: "string", description: "Instructies voor deze oefening" },
                          sets: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                set_number: { type: "number" },
                                reps: { type: "number", description: "Aantal herhalingen" },
                                weight: { type: "number", description: "Gewicht in kg (0 als onbekend)" },
                                rir: { type: "number", description: "Reps in reserve (1-3)" },
                                is_warmup: { type: "boolean" },
                              },
                              required: ["set_number", "reps"],
                            },
                          },
                        },
                        required: ["exercise_name", "order_index", "sets"],
                      },
                    },
                  },
                  required: ["title", "exercises"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_routine" } },
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI generate-routine error:", response.status, t);
        return new Response(JSON.stringify({ error: "Fout bij genereren schema" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "AI kon geen schema genereren" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let routineData;
      try {
        routineData = JSON.parse(toolCall.function.arguments);
      } catch {
        return new Response(JSON.stringify({ error: "Ongeldig schema formaat van AI" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the workout/routine in the database
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          title: routineData.title,
          notes: routineData.notes || null,
          is_template: true,
          date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (workoutError || !workout) {
        console.error("Workout insert error:", workoutError);
        return new Response(JSON.stringify({ error: "Fout bij aanmaken routine" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert exercises with valid IDs only
      const validExerciseIds = new Set(exerciseList.map(e => e.id));
      const exercisesToInsert = (routineData.exercises || []).filter((ex: any) =>
        ex.exercise_id && validExerciseIds.has(ex.exercise_id)
      );

      for (const ex of exercisesToInsert) {
        const { data: we, error: weError } = await supabase
          .from("workout_exercises")
          .insert({
            workout_id: workout.id,
            exercise_id: ex.exercise_id,
            order_index: ex.order_index ?? 0,
            notes: ex.notes || null,
          })
          .select()
          .single();

        if (weError || !we) {
          console.error("Workout exercise insert error:", weError);
          continue;
        }

        // Insert sets
        if (ex.sets && ex.sets.length > 0) {
          const setsToInsert = ex.sets.map((s: any) => ({
            workout_exercise_id: we.id,
            set_number: s.set_number,
            reps: s.reps || null,
            weight: s.weight || null,
            rir: s.rir || null,
            is_warmup: s.is_warmup || false,
            completed: false,
          }));

          await supabase.from("workout_sets").insert(setsToInsert);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          routineId: workout.id,
          routineTitle: routineData.title,
          exerciseCount: exercisesToInsert.length,
          message: routineData.notes || `Schema "${routineData.title}" is aangemaakt met ${exercisesToInsert.length} oefeningen.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================
    // ACTION: weekly-tip (called by cron job or admin)
    // =====================
    if (action === "weekly-tip") {
      const weeklyPrompt = `Analyseer de fitnessdata van de gebruiker van de afgelopen week en geef één concrete, persoonlijke tip of observatie. Maximaal 3 zinnen. Wees specifiek en gebruik de beschikbare data. Begin direct met de tip, geen intro.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemContext },
            { role: "user", content: weeklyPrompt },
          ],
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Fout bij genereren tip" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const tipContent = result.choices?.[0]?.message?.content;
      if (!tipContent) {
        return new Response(JSON.stringify({ error: "Geen tip gegenereerd" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save the tip as a proactive message
      await supabase.from("ai_coach_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: tipContent,
        metadata: { proactive: true },
      });

      return new Response(JSON.stringify({ success: true, tip: tipContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // ACTION: dashboard-insight (kort persoonlijk inzicht voor dashboard)
    // =====================
    if (action === "dashboard-insight") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Haal gisteren data op
      const { data: yesterdayLog } = await supabase
        .from("daily_logs")
        .select("steps, calorie_intake, calorie_burn, resting_heart_rate, active_minutes_very")
        .eq("user_id", user.id)
        .eq("log_date", yesterdayStr)
        .maybeSingle();

      const { data: yesterdaySleep } = await supabase
        .from("sleep_logs")
        .select("duration_minutes, efficiency, score")
        .eq("user_id", user.id)
        .eq("date", yesterdayStr)
        .maybeSingle();

      const yesterdayContext = yesterdayLog || yesterdaySleep
        ? `Gisteren (${yesterdayStr}): ${yesterdayLog?.steps ? yesterdayLog.steps + " stappen" : "geen stappen"}, ${yesterdayLog?.calorie_intake ? yesterdayLog.calorie_intake + " kcal intake" : ""}, ${yesterdaySleep ? Math.round((yesterdaySleep.duration_minutes || 0) / 60 * 10) / 10 + "u slaap (score " + (yesterdaySleep.score || "?") + ")" : "geen slaapdata"}.`
        : "Geen data van gisteren beschikbaar.";

      const insightPrompt = `Geef een korte, persoonlijke inzicht van 1-2 zinnen voor het dashboard van de gebruiker. Combineer gisteren met de trend van de afgelopen week. Wees direct, stimulerend en concreet. Benoem iets specifeks als dat opvalt (goed of slecht). Geen opener als "Hoi" of "Geweldig". Geen vragen. Begin gewoon met de observatie.

Gisteren: ${yesterdayContext}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemContext },
            { role: "user", content: insightPrompt },
          ],
          max_tokens: 120,
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Fout bij genereren inzicht" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const insightText = result.choices?.[0]?.message?.content?.trim();

      return new Response(
        JSON.stringify({ insight: insightText || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
