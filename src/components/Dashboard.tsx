import { useState, useEffect } from 'react';
import { BankData, Period, BANKS } from '@/types/bank';
import { fetchAllBanksData } from '@/services/stockService';
import { PeriodSelector } from './PeriodSelector';
import { BankCard } from './BankCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export const Dashboard = () => {
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setProgress({ completed: 0, total: BANKS.length });
    
    try {
      const data = await fetchAllBanksData(BANKS, (completed, total) => {
        setProgress({ completed, total });
      });
      
      if (data.length === 0) {
        toast({
          title: 'Ingen data hentet',
          description: 'Kunne ikke hente data for noen banker. Prøv igjen senere.',
          variant: 'destructive',
        });
      } else if (data.length < BANKS.length) {
        toast({
          title: 'Delvis vellykket',
          description: `Hentet data for ${data.length} av ${BANKS.length} banker.`,
        });
      } else {
        toast({
          title: 'Data oppdatert',
          description: `Alle ${data.length} banker er oppdatert.`,
        });
      }
      
      setBanksData(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Feil ved henting av data',
        description: 'En feil oppstod. Vennligst prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📊 Sparebank-dashboard – Oslo Børs</h1>
          <p className="text-muted-foreground">
            Sanntidsoversikt over norske sparebanker
          </p>
        </div>

        {/* Controls */}
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
            <Button 
              onClick={fetchData} 
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Oppdater data
            </Button>
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
        ) : (
          <>
            {/* Top Gainers and Losers */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Top Gainers */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold">Største stigere</h2>
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
                  <h2 className="text-2xl font-bold">Største fallere</h2>
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
              <div className="text-center text-sm text-muted-foreground">
                Sist oppdatert: {lastUpdated.toLocaleString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
