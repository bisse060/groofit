import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Dumbbell, Camera, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const baseNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/daily-logs', icon: FileText, labelKey: 'nav.dailyLogs' },
  { path: '/workouts', icon: Dumbbell, labelKey: 'nav.workouts' },
  { path: '/comparisons', icon: Camera, labelKey: 'nav.comparisons' },
];

export default function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  const navItems = isAdmin 
    ? [...baseNavItems, { path: '/admin', icon: Shield, labelKey: 'nav.admin' }]
    : [...baseNavItems, { path: '/profile', icon: User, labelKey: 'nav.profile' }];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
