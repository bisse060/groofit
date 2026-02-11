import { useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, RefreshCw, Search } from 'lucide-react';

export default function VersionInfo() {
  const { currentVersion, remoteVersion, checkNow, forceRefresh, updateAvailable } = useVersionCheck();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await checkNow();
    setChecking(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('nl-NL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Over Grofit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">App versie:</span>
            <span className="font-mono text-xs">{currentVersion?.version || '...'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Build tijd:</span>
            <span className="text-xs">{currentVersion?.buildTime ? formatDate(currentVersion.buildTime) : '...'}</span>
          </div>
        </div>

        {updateAvailable && (
          <div className="p-2 bg-primary/10 text-primary rounded text-xs">
            ✨ Nieuwe versie beschikbaar! (v{remoteVersion?.version})
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
            <Search className={`h-3.5 w-3.5 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
            Check op updates
          </Button>
          <Button variant="outline" size="sm" onClick={forceRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Hard refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
