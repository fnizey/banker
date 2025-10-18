import { useState, useEffect } from 'react';
import { BANKS } from '@/types/bank';
import type { BankData, Period } from '@/types/bank';
import { fetchAllBanksData } from '@/services/stockService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Navigation } from '@/components/Navigation';
import { NewsFeed } from '@/components/NewsFeed';
import { PeriodSelector } from '@/components/PeriodSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Charts = () => {
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    toast.info('Henter data for alle banker...');
    
    try {
      const data = await fetchAllBanksData(BANKS);
      setBanksData(data);
      setLastUpdated(new Date());
      if (selectedBanks.length === 0 && data.length > 0) {
        setSelectedBanks([data[0].ticker, data[1]?.ticker].filter(Boolean));
      }
      toast.success(`Oppdatert data for ${data.length} banker`);
    } catch (error) {
      toast.error('Kunne ikke hente data');
      console.error('Error fetching data:', error);
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
    }
  };

  const toggleBank = (ticker: string) => {
    setSelectedBanks(prev => 
      prev.includes(ticker) 
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
  };

  const chartData = selectedBanks.map(ticker => {
    const bank = banksData.find(b => b.ticker === ticker);
    if (!bank) return null;
    return {
      name: bank.name,
      change: getChangeForPeriod(bank),
      ticker: bank.ticker
    };
  }).filter(Boolean);

  const averageChange = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + (d?.change || 0), 0) / chartData.length
    : 0;

  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Sammenligning</h2>
                <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Endring (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="change" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Endring %"
                  />
                </LineChart>
              </ResponsiveContainer>

              {chartData.length > 0 && (
                <div className="mt-4 p-4 bg-accent rounded-lg">
                  <p className="text-sm font-medium">
                    Gjennomsnittlig endring: 
                    <span className={averageChange >= 0 ? 'text-success ml-2' : 'text-destructive ml-2'}>
                      {averageChange >= 0 ? '+' : ''}{averageChange.toFixed(2)}%
                    </span>
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Velg banker å sammenligne</h3>
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {banksData.map((bank) => (
                    <div key={bank.ticker} className="flex items-center space-x-2">
                      <Checkbox
                        id={bank.ticker}
                        checked={selectedBanks.includes(bank.ticker)}
                        onCheckedChange={() => toggleBank(bank.ticker)}
                      />
                      <Label htmlFor={bank.ticker} className="text-sm cursor-pointer">
                        {bank.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Sist oppdatert: {lastUpdated.toLocaleString('nb-NO')}
              </p>
            )}
          </div>

          <div className="lg:col-span-1">
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;
