
# Fix: Afbeeldingen zichtbaar maken in Exercise Picker Dialog

## Probleem
De `ExercisePickerDialog` (het scherm "Oefening Toevoegen") toont afbeeldingen niet correct. De `image_url` wordt als relatief pad opgeslagen (bijv. `userId/filename.png`), maar de dialog gebruikt dit pad direct als `<img src>` zonder eerst een signed URL te genereren voor de privé storage bucket.

## Oplossing
De `loadExercises` functie in `ExercisePickerDialog.tsx` moet dezelfde signed URL logica krijgen als de `ExerciseLibrary.tsx`.

## Technische details

### Bestand: `src/components/workouts/ExercisePickerDialog.tsx`

1. **Signed URL generatie toevoegen aan `loadExercises`**: Na het ophalen van de exercises uit de database, voor elke exercise met een `image_url`:
   - Als het pad niet begint met `http` (nieuw formaat): gebruik het direct als pad voor `createSignedUrl`
   - Als het pad een legacy volledige URL is met `exercise-images`: extraheer het bestandspad
   - Genereer een signed URL via `supabase.storage.from('exercise-images').createSignedUrl(filePath, 3600)`
   - Vervang de `image_url` in het exercise object met de signed URL

Dit is exact dezelfde logica die al werkt in `ExerciseLibrary.tsx` (regels 81-107).
