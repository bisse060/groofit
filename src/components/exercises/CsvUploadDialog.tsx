import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CsvUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface CsvExerciseRow {
  name: string;
  body_part?: string;
  difficulty?: string;
  equipment?: string;
  instructions?: string;
  image_url?: string;
  video_url?: string;
  primary_muscles?: string;
  secondary_muscles?: string;
}

export function CsvUploadDialog({ open, onClose, onImportComplete }: CsvUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      ["name", "body_part", "difficulty", "equipment", "instructions", "image_url", "video_url", "primary_muscles", "secondary_muscles"],
      ["Barbell Squat", "Legs", "Intermediate", "Barbell", "Stand with feet shoulder-width apart...", "", "", "Quadriceps,Glutes", "Hamstrings,Core"],
      ["Push Up", "Chest", "Beginner", "Bodyweight", "Start in plank position...", "", "", "Chest,Triceps", "Shoulders,Core"],
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exercises_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Ongeldig bestand",
        description: "Upload een .csv bestand",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress("Bestand wordt ingelezen...");

    Papa.parse<CsvExerciseRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast({
              title: "Niet ingelogd",
              description: "Je moet ingelogd zijn om oefeningen te importeren",
              variant: "destructive",
            });
            setUploading(false);
            return;
          }

          const exercises = results.data.map((row) => ({
            user_id: user.id,
            name: row.name,
            body_part: row.body_part || null,
            difficulty: row.difficulty || null,
            equipment: row.equipment || null,
            instructions: row.instructions || null,
            image_url: row.image_url || null,
            video_url: row.video_url || null,
            primary_muscles: row.primary_muscles 
              ? row.primary_muscles.split(",").map(m => m.trim()) 
              : null,
            secondary_muscles: row.secondary_muscles 
              ? row.secondary_muscles.split(",").map(m => m.trim()) 
              : null,
            is_favorite: false,
          }));

          setProgress(`${exercises.length} oefeningen worden toegevoegd...`);

          const { error } = await supabase
            .from("exercises")
            .insert(exercises);

          if (error) throw error;

          toast({
            title: "Import succesvol",
            description: `${exercises.length} oefeningen zijn toegevoegd`,
          });

          onImportComplete();
          onClose();
        } catch (error) {
          console.error("Import error:", error);
          toast({
            title: "Import mislukt",
            description: error instanceof Error ? error.message : "Er is een fout opgetreden",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
          setProgress("");
        }
      },
      error: (error) => {
        toast({
          title: "Bestand lezen mislukt",
          description: error.message,
          variant: "destructive",
        });
        setUploading(false);
        setProgress("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Oefeningen importeren via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Download eerst de template om te zien welke kolommen vereist zijn. 
              Gebruik komma's om meerdere spieren te scheiden (bijv. "Chest,Triceps").
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>

          <div className="border-t pt-4">
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:bg-accent transition-colors">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Klik om CSV bestand te selecteren
                  </p>
                </div>
              </div>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {progress && (
            <p className="text-sm text-muted-foreground text-center">{progress}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
