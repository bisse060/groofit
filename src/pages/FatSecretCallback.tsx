import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const FatSecretCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const oauth_token = searchParams.get("oauth_token");
        const oauth_verifier = searchParams.get("oauth_verifier");

        if (!oauth_token || !oauth_verifier) {
          throw new Error("Missing oauth_token or oauth_verifier");
        }

        const { data, error } = await supabase.functions.invoke("fatsecret-auth-callback", {
          body: { oauth_token, oauth_verifier },
        });

        if (error) throw error;

        if (data.success) {
          setStatus("success");
          toast.success("FatSecret succesvol verbonden!");

          // Trigger initial sync for today
          try {
            await supabase.functions.invoke("fatsecret-sync-food", {
              body: {},
            });
          } catch (syncErr) {
            console.error("Initial sync error:", syncErr);
          }

          setTimeout(() => navigate("/profile"), 2000);
        } else {
          throw new Error("Callback failed");
        }
      } catch (error) {
        console.error("FatSecret callback error:", error);
        setStatus("error");
        toast.error("Fout bij verbinden met FatSecret");
        setTimeout(() => navigate("/profile"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg text-foreground">FatSecret verbinding wordt verwerkt...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-12 w-12 mx-auto bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-2xl">✓</span>
            </div>
            <p className="text-lg text-foreground">Succesvol verbonden! Je wordt doorgestuurd...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-12 w-12 mx-auto bg-destructive rounded-full flex items-center justify-center">
              <span className="text-destructive-foreground text-2xl">✗</span>
            </div>
            <p className="text-lg text-foreground">Er is iets misgegaan. Je wordt teruggestuurd...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FatSecretCallback;
