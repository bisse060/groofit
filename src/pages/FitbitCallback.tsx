import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const FitbitCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          throw new Error("Missing authorization code or state");
        }

        const redirectUrl = `${window.location.origin}/fitbit/callback`;

        const { data, error } = await supabase.functions.invoke("fitbit-auth-callback", {
          body: { code, state, redirectUrl },
        });

        if (error) throw error;

        if (data.success) {
          setStatus("success");
          toast.success("Fitbit succesvol verbonden!");
          setTimeout(() => navigate("/profile"), 2000);
        } else {
          throw new Error("Callback failed");
        }
      } catch (error) {
        console.error("Fitbit callback error:", error);
        setStatus("error");
        toast.error("Fout bij verbinden met Fitbit");
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
            <p className="text-lg text-foreground">Fitbit verbinding wordt verwerkt...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-12 w-12 mx-auto bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">✓</span>
            </div>
            <p className="text-lg text-foreground">Succesvol verbonden! Je wordt doorgestuurd...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-12 w-12 mx-auto bg-destructive rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">✗</span>
            </div>
            <p className="text-lg text-foreground">Er is iets misgegaan. Je wordt teruggestuurd...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FitbitCallback;
