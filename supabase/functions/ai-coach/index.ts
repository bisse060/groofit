import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { messages } = await req.json()

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")

   const { data, error } = await supabase.functions.invoke("ai-coach", {
  body: { messages }
})

if (error) {
  console.error(error)
  throw new Error("AI Coach failed")
}

const aiReply = data?.choices?.[0]?.message?.content
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    })
  }
})