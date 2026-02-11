import { useVersionCheck } from '@/hooks/useVersionCheck';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export default function UpdateBanner() {
  const { updateAvailable, dismissUpdate, forceRefresh } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] shadow-lg animate-in slide-in-from-top duration-300">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Nieuwe versie beschikbaar</p>
          <p className="text-xs opacity-80">Tik op verversen om de laatste updates te laden.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs px-2.5"
            onClick={forceRefresh}
          >
            Ververs nu
          </Button>
          <button
            onClick={dismissUpdate}
            className="p-1 rounded-md hover:bg-primary-foreground/20 transition-colors"
            aria-label="Later"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
