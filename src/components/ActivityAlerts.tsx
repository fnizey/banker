import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BankData } from '@/types/bank';

interface ActivityAlertsProps {
  banksData: BankData[];
}

export const ActivityAlerts = ({ banksData }: ActivityAlertsProps) => {
  const volumeAlerts = banksData
    .filter(bank => bank.volumeAlert && bank.volumeAlert.severity !== 'normal')
    .sort((a, b) => (b.volumeAlert?.deviations || 0) - (a.volumeAlert?.deviations || 0));

  const priceAlerts = banksData
    .filter(bank => bank.priceAlert && bank.priceAlert.type !== 'none')
    .sort((a, b) => Math.abs(b.priceAlert?.changePercent || 0) - Math.abs(a.priceAlert?.changePercent || 0));

  if (volumeAlerts.length === 0 && priceAlerts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Uvanlig aktivitet</h2>
        </div>
        <p className="text-muted-foreground">Ingen uvanlige bevegelser registrert</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Uvanlig aktivitet</h2>
      </div>

      <div className="space-y-6">
        {/* Volume Alerts */}
        {volumeAlerts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Høy omsetning</h3>
            </div>
            <div className="space-y-2">
              {volumeAlerts.map(bank => {
                const alert = bank.volumeAlert!;
                const severity = alert.severity === 'high' ? 'destructive' : 'default';
                
                return (
                  <div key={bank.ticker} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bank.name}</span>
                        <Badge variant={severity}>
                          {alert.deviations.toFixed(1)} σ
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Omsettes {alert.deviations.toFixed(1)} std.avv. over snittet siste 30 dager
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {(alert.currentVolume / 1000).toFixed(0)}k
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Snitt: {(alert.avgVolume / 1000).toFixed(0)}k
                      </div>
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
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Kursbevegelser</h3>
            </div>
            <div className="space-y-2">
              {priceAlerts.map(bank => {
                const alert = bank.priceAlert!;
                const isHigh = alert.type === 'high';
                
                return (
                  <div key={bank.ticker} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bank.name}</span>
                        {isHigh ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.message}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${isHigh ? 'text-success' : 'text-destructive'}`}>
                        {isHigh ? '+' : ''}{alert.changePercent.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bank.currentPrice.toFixed(2)} NOK
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
