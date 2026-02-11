import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Share, Plus, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;

  useEffect(() => {
    if (isInStandaloneMode) return;

    const dismissedAt = localStorage.getItem('install-prompt-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
      return;
    }

    if (isIOS) {
      setShowIOSPrompt(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSPrompt(false);
    setDeferredPrompt(null);
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
  };

  if (isInStandaloneMode || dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  const isNL = language === 'nl';

  return (
    <div className="fixed bottom-20 left-3 right-3 md:bottom-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isNL ? 'Installeer Grofit' : 'Install Grofit'}
            </p>
            {isIOS ? (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {isNL
                    ? 'Voeg Grofit toe aan je beginscherm voor de beste ervaring:'
                    : 'Add Grofit to your home screen for the best experience:'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    1. <Share className="h-3 w-3 inline" /> {isNL ? 'Tik op Deel' : 'Tap Share'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    2. <Plus className="h-3 w-3 inline" /> {isNL ? '"Zet op beginscherm"' : '"Add to Home Screen"'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {isNL
                  ? 'Installeer de app voor snellere toegang en een betere ervaring.'
                  : 'Install the app for faster access and a better experience.'}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {deferredPrompt && (
          <Button size="sm" className="w-full mt-3 gap-1.5" onClick={handleInstall}>
            <Download className="h-4 w-4" />
            {isNL ? 'Installeren' : 'Install'}
          </Button>
        )}
      </div>
    </div>
  );
}
