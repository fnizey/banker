import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useBankData } from '@/contexts/BankDataContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export const AlertsBell = () => {
  const { banksData } = useBankData();
  const [open, setOpen] = useState(false);

  const volumeAlerts = banksData
    .filter(bank => bank.volumeAlert && bank.volumeAlert.severity !== 'normal')
    .sort((a, b) => (b.volumeAlert?.deviations || 0) - (a.volumeAlert?.deviations || 0));

  const priceAlerts = banksData
    .filter(bank => bank.priceAlert && bank.priceAlert.type !== 'none')
    .sort((a, b) => Math.abs(b.priceAlert?.changePercent || 0) - Math.abs(a.priceAlert?.changePercent || 0));

  const totalAlerts = volumeAlerts.length + priceAlerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalAlerts > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalAlerts}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Markante bevegelser</h3>
            {totalAlerts > 0 && (
              <Badge variant="secondary">{totalAlerts}</Badge>
            )}
          </div>

          {totalAlerts === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ingen uvanlige bevegelser registrert
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {/* Volume Alerts */}
                {volumeAlerts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      HØY OMSETNING
                    </h4>
                    <div className="space-y-2">
                      {volumeAlerts.map(bank => {
                        const alert = bank.volumeAlert!;
                        const severity = alert.severity === 'high' ? 'destructive' : 'default';
                        
                        return (
                          <div key={bank.ticker} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{bank.name}</span>
                                  <Badge variant={severity} className="text-xs">
                                    {alert.deviations.toFixed(1)} σ
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {alert.deviations.toFixed(1)} std.avv. over snitt
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <div className="font-medium">
                                  {(alert.currentVolume / 1000).toFixed(0)}k
                                </div>
                                <div className="text-muted-foreground">
                                  ⌀ {(alert.avgVolume / 1000).toFixed(0)}k
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {volumeAlerts.length > 0 && priceAlerts.length > 0 && (
                  <Separator />
                )}

                {/* Price Alerts */}
                {priceAlerts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      KURSBEVEGELSER
                    </h4>
                    <div className="space-y-2">
                      {priceAlerts.map(bank => {
                        const alert = bank.priceAlert!;
                        const isHigh = alert.type === 'high';
                        
                        return (
                          <div key={bank.ticker} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm mb-1">{bank.name}</div>
                                <p className="text-xs text-muted-foreground">
                                  {alert.message}
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <div className={`font-medium ${isHigh ? 'text-success' : 'text-destructive'}`}>
                                  {isHigh ? '+' : ''}{alert.changePercent.toFixed(1)}%
                                </div>
                                <div className="text-muted-foreground">
                                  {bank.currentPrice.toFixed(2)} NOK
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
