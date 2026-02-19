
# AI Coach implementeren in Grofit

## Kosten om te bouwen (Lovable editor credits)

Dit is een uitgebreid onderdeel met meerdere componenten. De schatting:

- Database migratie aanmaken: 1 credit
- Edge function `ai-coach` schrijven (chat + schema-generator): 1-2 credits
- Nieuwe Coach-pagina met chatinterface: 1-2 credits
- Navigatie updaten + routing: 1 credit
- Proactieve tips-systeem (admin-triggered of automatisch): 1 credit
- Eventuele bugfixes en verfijning: 1-2 credits

**Totale schatting: 6 tot 9 Lovable-credits om te bouwen.**

## Runtime kosten (Lovable AI per gesprek)

Het model `google/gemini-3-flash-preview` is zeer goedkoop. Een normale chatvraag (inclusief de contextinjectie van trainingsdata) kost een fractie van een eurocent per bericht. Een schema-generatie (iets meer output) blijft onder de 0,01 eurocent. Bij normaal gebruik van een paar vragen per dag per gebruiker zijn de maandelijkse AI-kosten verwaarloosbaar en vallen ze binnen de gratis inbegrepen credits van Lovable Cloud.

---

## Wat er gebouwd wordt

De AI Coach krijgt drie functies:

1. **Vrij gesprek** - Gebruikers kunnen vragen stellen zoals "Hoe herstel ik sneller?" of "Wat is een goede warming-up voor benen?"
2. **Trainingschema genereren** - Op verzoek maakt de coach een volledig schema dat direct als routine wordt opgeslagen in de app
3. **Proactieve tips** - Wekelijkse automatische tips op basis van de data van de gebruiker (via een cron job, zoals de bestaande Fitbit auto-sync)

---

## Technische aanpak

### 1. Database migratie

Nieuwe tabel `ai_coach_messages` voor gespreksgeschiedenis:

```sql
CREATE TABLE ai_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coach messages"
  ON ai_coach_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Edge Function: `ai-coach`

Een enkele edge function met twee acties, geselecteerd via de `action` parameter in de request body:

**`action: "chat"`** - Normaal gesprek:
- Haalt profiel op (naam, doelen, gewicht, streefgewicht, lengte)
- Haalt laatste 7 dagen workouts op (oefeningen, sets, volume per dag)
- Haalt laatste 3 metingen op (gewicht, taille, borst, heupen)
- Haalt laatste 7 dagen slaapdata op (duur, fases, efficiëntie)
- Haalt laatste 7 dagen daglogboek op (stappen, calorieën, actieve minuten)
- Stuurt dit alles als systeem-context mee in het Nederlands
- Streamt het antwoord terug token voor token via SSE

**`action: "generate-routine"`** - Schema aanmaken:
- Zelfde context als hierboven plus de naam/beschrijving van het gewenste schema
- Haalt de bestaande oefeningen van de gebruiker op uit de `exercises` tabel
- Gebruikt tool calling om gestructureerde JSON te genereren (oefeningenlijst + sets per oefening)
- Maakt automatisch een nieuwe routine aan in `workouts` (`is_template = true`)
- Voegt de oefeningen toe via `workout_exercises` en `workout_sets`
- Geeft de routine-id terug zodat de gebruiker er direct naartoe kan navigeren

**`action: "weekly-tip"`** - Proactieve tip (voor de cron job):
- Analyseert de data van de afgelopen week
- Genereert een korte motiverende tip of observatie
- Slaat deze op als `role: 'assistant'` bericht in `ai_coach_messages` met metadata `{ proactive: true }`
- De gebruiker ziet dit de volgende keer dat hij de Coach opent

Systeem-prompt instrueert de coach als personal trainer in het Nederlands, vriendelijk en to-the-point.

```toml
[functions.ai-coach]
verify_jwt = true
```

### 3. Proactieve tips via cron job

Vergelijkbaar met de bestaande `fitbit-auto-sync`, een nieuwe `ai-coach-weekly-tips` edge function die:
- Elke zondag automatisch wordt uitgevoerd
- Voor elke actieve gebruiker een wekelijkse tip genereert
- Tips opslaat in `ai_coach_messages` zodat ze klaarstaan wanneer de gebruiker inlogt
- Een badge/notificatie toont als er een nieuwe proactieve tip is

### 4. Nieuwe pagina `src/pages/Coach.tsx`

Chatinterface met:
- Berichtenlijst, gesorteerd op tijd, laadt bestaande geschiedenis uit de database bij openen
- Streamende antwoorden die token voor token binnenkomen
- Basis markdown rendering (vet, lijstjes, kopjes) via eenvoudige regex-replacements (geen extra package nodig)
- Snelkoppelingen bovenaan als klikbare chips:
  - "Analyseer mijn vorige week"
  - "Maak een trainingsschema voor mij"
  - "Geef me slaaptips"
  - "Hoe kan ik progressie maken op mijn bench?"
- Als de AI een schema heeft aangemaakt: directe "Bekijk routine" knop onder het antwoord
- Proactieve tips krijgen een speciaal "Coach tip" label bovenaan
- Invoerveld onderaan, sticky boven de bottom nav (rekening houdend met mobiel toetsenbord)

### 5. Navigatie

**`src/components/Layout.tsx`** - Toevoegen aan navItems:
```typescript
{ path: '/coach', icon: Sparkles, label: 'Coach' }
```

**`src/components/navigation/BottomNav.tsx`** - Toevoegen aan moreItems:
```typescript
{ path: '/coach', icon: Sparkles, labelKey: 'nav.coach' }
```

**`src/contexts/LanguageContext.tsx`** - Vertalingen:
```typescript
'nav.coach': { nl: 'Coach', en: 'Coach' }
```

**`src/App.tsx`** - Nieuwe route:
```tsx
<Route path="/coach" element={<Coach />} />
```

---

## Implementatiestappen in volgorde

1. Database migratie voor `ai_coach_messages`
2. Edge function `supabase/functions/ai-coach/index.ts` schrijven
3. Edge function `supabase/functions/ai-coach-weekly-tips/index.ts` schrijven (proactieve tips)
4. `supabase/config.toml` updaten met beide functies
5. Nieuwe pagina `src/pages/Coach.tsx` aanmaken
6. Route toevoegen in `src/App.tsx`
7. Nav-items en vertaling toevoegen in `Layout.tsx`, `BottomNav.tsx` en `LanguageContext.tsx`

---

## Beschikbaar voor alle gebruikers

De Coach wordt standaard beschikbaar voor alle ingelogde gebruikers - geen feature flag nodig. Als je hem later wilt beperken tot specifieke gebruikers, kan de bestaande feature-flag infrastructuur eenvoudig worden uitgebreid.
