import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import logoWide from '@/assets/grofit-logo-wide.png';
import BottomNav from '@/components/navigation/BottomNav';
import {
  LayoutDashboard,
  User,
  FileText,
  Ruler,
  GitCompare,
  Shield,
  LogOut,
  Moon,
  Dumbbell,
  BookOpen,
  Sun,
  HeartPulse,
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { signOut, isAdmin } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/profile', icon: User, label: t('nav.profile') },
    { path: '/daily-logs', icon: FileText, label: t('nav.dailyLogs') },
    { path: '/measurements', icon: Ruler, label: t('nav.measurements') },
    { path: '/sleep', icon: Moon, label: t('nav.sleep') },
    { path: '/health', icon: HeartPulse, label: t('nav.health') },
    { path: '/workouts', icon: Dumbbell, label: t('nav.workouts') },
    { path: '/exercises', icon: BookOpen, label: t('nav.exercises') },
    { path: '/comparisons', icon: GitCompare, label: t('nav.comparisons') },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', icon: Shield, label: t('nav.admin') });
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-background w-full overflow-hidden">
      {/* Header - Fixed on mobile, sticky on desktop */}
      <header className="fixed md:sticky top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="px-4 h-14 flex items-center justify-between max-w-7xl mx-auto">
          <Link to="/dashboard" className="flex items-center">
            <img src={logoWide} alt="Grofit" className="h-8" />
          </Link>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <Button
                variant={language === 'nl' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('nl')}
                className="h-8 px-2 text-xs"
              >
                NL
              </Button>
              <Button
                variant={language === 'en' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('en')}
                className="h-8 px-2 text-xs"
              >
                EN
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={signOut}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header on mobile */}
      <div className="h-14 md:hidden" />

      {/* Desktop Navigation - Hidden on mobile */}
      <nav className="hidden md:block sticky top-14 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="px-4 max-w-7xl mx-auto">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`flex items-center gap-2 whitespace-nowrap h-9 ${
                      isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="page-container">
        {children}
      </main>

      {/* Bottom Navigation - Mobile only */}
      <BottomNav />
    </div>
  );
}
