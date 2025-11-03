import { Bell, Activity, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useBankData } from '@/contexts/BankDataContext';
import { BankData } from '@/types/bank';
import { ScrollArea } from '@/components/ui/scroll-area';

export const AlertsBell = () => {
  const { banksData } = useBankData();

  const volumeAlerts = banksData
    .filter(bank => bank.volumeAlert && bank.volumeAlert.severity !== 'normal')
    .sort((a, b) => (b.volumeAlert?.deviations || 0) - (a.volumeAlert?.deviations || 0));

  const priceAlerts = banksData
    .filter(bank => bank.priceAlert && bank.priceAlert.type !== 'none')
    .sort((a, b) => Math.abs(b.priceAlert?.changePercent || 0) - Math.abs(a.priceAlert?.changePercent || 0));

  const totalAlerts = volumeAlerts.length + priceAlerts.length;

  const formatAlertDate = (bank: BankData) => {
    if (!bank.lastUpdated) return '';
    const date = new Date(bank.lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min siden`;
    } else if (diffHours < 24) {
      return `${diffHours}t siden`;
    } else {
      return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-accent/10 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {totalAlerts > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {totalAlerts}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-xl border-2" align="end">
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Markante bevegelser</h3>
              <p className="text-xs text-muted-foreground">
                {totalAlerts === 0 ? 'Ingen varsler' : `${totalAlerts} aktive varsler`}
              </p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="h-[450px]">
          {totalAlerts === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Ingen uvanlige bevegelser detektert</p>
              <p className="text-xs mt-2">Varsler vises når banker har uvanlig høy omsetning eller når de treffer nye høyder/lavpunkter</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Volume Alerts */}
              {volumeAlerts.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                    <Activity className="h-4 w-4" />
                    HØY OMSETNING
                  </h4>
                  <div className="space-y-2">
                    {volumeAlerts.map(bank => {
                      const alert = bank.volumeAlert!;
                      const bgColor = alert.severity === 'high' 
                        ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/15' 
                        : 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15';
                      
                      return (
                        <div 
                          key={bank.ticker}
                          className={`p-3 rounded-lg border transition-all ${bgColor}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-semibold text-sm">{bank.name}</div>
                            <Badge 
                              variant={alert.severity === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {alert.severity === 'high' ? '🔴 Høy' : '🟠 Advarsel'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            📊 Omsetning <strong>{alert.deviations.toFixed(1)}σ</strong> over snittet (30 dager)
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="space-x-2">
                              <span className="text-muted-foreground">
                                Snitt: {(alert.avgVolume / 1000).toFixed(0)}k
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-bold">
                                I dag: {(alert.currentVolume / 1000).toFixed(0)}k
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {formatAlertDate(bank)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Alerts */}
              {priceAlerts.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                    <TrendingUp className="h-4 w-4" />
                    KURSBEVEGELSER
                  </h4>
                  <div className="space-y-2">
                    {priceAlerts.map(bank => {
                      const alert = bank.priceAlert!;
                      const isHigh = alert.type === 'high';
                      const bgColor = isHigh 
                        ? 'bg-success/10 border-success/30 hover:bg-success/15' 
                        : 'bg-destructive/10 border-destructive/30 hover:bg-destructive/15';
                      
                      return (
                        <div 
                          key={bank.ticker}
                          className={`p-3 rounded-lg border transition-all ${bgColor}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-semibold text-sm">{bank.name}</div>
                            <Badge 
                              variant={isHigh ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {isHigh ? '📈 Høy' : '📉 Lav'}
                            </Badge>
                          </div>
                          <div className="text-xs mb-2">
                            {alert.message}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-bold">
                              {isHigh ? '🟢 ' : '🔴 '}{isHigh ? '+' : ''}{alert.changePercent.toFixed(2)}% fra {isHigh ? 'lavpunkt' : 'høydepunkt'}
                            </div>
                            <span className="text-muted-foreground">
                              {formatAlertDate(bank)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
