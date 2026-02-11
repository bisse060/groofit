import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import UpdateBanner from "@/components/UpdateBanner";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import DailyLogs from "./pages/DailyLogs";
import Measurements from "./pages/Measurements";
import Comparisons from "./pages/Comparisons";
import Health from "./pages/Health";
import Sleep from "./pages/Sleep";
import Workouts from "./pages/Workouts";
import WorkoutDetail from "./pages/WorkoutDetail";
import RoutineEditor from "./pages/RoutineEditor";
import ExerciseLibrary from "./pages/ExerciseLibrary";
import ExerciseDetail from "./pages/ExerciseDetail";
import Admin from "./pages/Admin";
import FitbitCallback from "./pages/FitbitCallback";
import Nutrition from "./pages/Nutrition";
import FatSecretCallback from "./pages/FatSecretCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateBanner />
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/daily-logs" element={<DailyLogs />} />
                <Route path="/measurements" element={<Measurements />} />
                <Route path="/comparisons" element={<Comparisons />} />
                <Route path="/health" element={<Health />} />
                <Route path="/nutrition" element={<Nutrition />} />
                <Route path="/sleep" element={<Sleep />} />
                <Route path="/workouts" element={<Workouts />} />
                <Route path="/workouts/:id" element={<WorkoutDetail />} />
                <Route path="/routines/new" element={<RoutineEditor />} />
                <Route path="/routines/:id" element={<RoutineEditor />} />
                <Route path="/exercises" element={<ExerciseLibrary />} />
                <Route path="/exercises/:id" element={<ExerciseDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/fitbit/callback" element={<FitbitCallback />} />
                <Route path="/fatsecret/callback" element={<FatSecretCallback />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
