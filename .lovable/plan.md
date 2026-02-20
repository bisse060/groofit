
# Naam wijzigen naar "Sven"

Een eenvoudige doorvoering van de naam "Sven" op alle relevante plekken.

## Bestanden en wijzigingen

### 1. `supabase/functions/ai-coach/index.ts`
- Systeem-prompt aanpassen: de coach stelt zichzelf voor als "Sven"
- Regel ~194: toevoegen van `"Je naam is Sven."` aan het begin van de `systemContext`

### 2. `src/pages/Coach.tsx`
- Regel 380: `"AI Coach"` → `"Sven"` (header titel)
- Regel 406: `"Hoi! Ik ben je AI Coach"` → `"Hoi! Ik ben Sven"`
- Regel 513: placeholder `"Stel een vraag aan je coach..."` → `"Stel Sven een vraag..."` (optioneel, maakt het persoonlijker)

### 3. `src/components/dashboard/CoachInsightCard.tsx`
- Regel 107: `"AI Coach kon geen inzicht laden."` → `"Sven kon geen inzicht laden."`
- Regel 128: label `"AI Coach"` → `"Sven"`

### 4. `src/pages/Profile.tsx`
- Regel 584: `"De AI Coach gebruikt..."` → `"Sven gebruikt..."`
- Regel 595: `"Sta de AI Coach toe..."` → `"Sta Sven toe..."`
- Regel 652: `"De AI Coach verwerkt data..."` → `"Sven verwerkt data..."`

Na de wijzigingen wordt de edge function automatisch opnieuw gedeployed zodat Sven zichzelf ook in de chat zo noemt.
