import { useState } from 'react';
import { BankData, Period } from '@/types/bank';
import { useBankData } from '@/contexts/BankDataContext';
import { PeriodSelector } from './PeriodSelector';
import { BankCard } from './BankCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation } from './Navigation';
import { ActivityAlerts } from './ActivityAlerts';

export const Dashboard = () => {
  const { banksData, loading, lastUpdated, progress, fetchData } = useBankData();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');


  const getChangeForPeriod = (bank: BankData): number => {
    switch (selectedPeriod) {
      case 'today': return bank.todayChange;
      case 'month': return bank.monthChange;
      case 'ytd': return bank.ytdChange;
      case 'year': return bank.yearChange;
      default: return 0;
    }
  };

  const sortedBanks = [...banksData].sort((a, b) => {
    return getChangeForPeriod(b) - getChangeForPeriod(a);
  });

  const topGainers = sortedBanks.slice(0, 3);
  const topLosers = sortedBanks.slice(-3).reverse();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold">📊 Sparebank-dashboard – Oslo Børs</h1>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <Navigation />

        <div className="space-y-6">
            <Card className="p-6 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
              </div>
              {loading && (
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Laster data: {progress.completed} av {progress.total} banker
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {loading && banksData.length === 0 ? (
              <div className="grid md:grid-cols-2 gap-8">
                {[0, 1].map((col) => (
                  <div key={col} className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            ) : banksData.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-semibold mb-2">Ingen data lastet</h3>
                <p className="text-muted-foreground mb-4">
                  Klikk på "Oppdater data" for å laste inn bankdata
                </p>
                <Button onClick={fetchData} size="lg">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Last inn data
                </Button>
              </Card>
            ) : (
              <>
                {/* Top Gainers and Losers */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  {/* Top Gainers */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-6 h-6 text-success" />
                      <h2 className="text-2xl font-bold">Best Utvikling</h2>
                    </div>
                    <div className="space-y-3">
                      {topGainers.map((bank, index) => (
                        <BankCard 
                          key={bank.ticker} 
                          bank={bank} 
                          period={selectedPeriod}
                          rank={index + 1}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Top Losers */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown className="w-6 h-6 text-destructive" />
                      <h2 className="text-2xl font-bold">Dårligst Utvikling</h2>
                    </div>
                    <div className="space-y-3">
                      {topLosers.map((bank, index) => (
                        <BankCard 
                          key={bank.ticker} 
                          bank={bank} 
                          period={selectedPeriod}
                          rank={index + 1}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Last Updated */}
                {lastUpdated && (
                  <div className="text-sm text-muted-foreground">
                    Sist oppdatert: {lastUpdated.toLocaleString('nb-NO', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {/* Activity Alerts */}
                <ActivityAlerts banksData={banksData} />
              </>
            )}
        </div>
      </div>
    </div>
  );
};
