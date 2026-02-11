import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Dumbbell, User, Shield, HeartPulse, MoreHorizontal, Ruler, GitCompare, BookOpen, Camera, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const baseNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/daily-logs', icon: FileText, labelKey: 'nav.dailyLogs' },
  { path: '/health', icon: HeartPulse, labelKey: 'nav.health' },
  { path: '/workouts', icon: Dumbbell, labelKey: 'nav.workouts' },
];

const moreItems = [
  { path: '/nutrition', icon: UtensilsCrossed, labelKey: 'nav.nutrition' },
  { path: '/profile', icon: User, labelKey: 'nav.profile' },
  { path: '/measurements', icon: Ruler, labelKey: 'nav.measurements' },
  { path: '/comparisons', icon: GitCompare, labelKey: 'nav.comparisons' },
  { path: '/exercises', icon: BookOpen, labelKey: 'nav.exercises' },
];

export default function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const allMoreItems = isAdmin 
    ? [...moreItems, { path: '/admin', icon: Shield, labelKey: 'nav.admin' }]
    : moreItems;

  const isMoreActive = allMoreItems.some(
    item => location.pathname === item.path || location.pathname.startsWith(item.path)
  );

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 right-2 mb-1 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[180px] safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {allMoreItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-bottom">
        <div className="flex items-center justify-around h-16">
          {baseNavItems.map((item) => {
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

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              isMoreActive || showMore
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5", (isMoreActive || showMore) && "stroke-[2.5]")} />
            <span className="text-[10px] font-medium">{t('nav.more') || 'Meer'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
