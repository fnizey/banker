import { useState, useEffect } from 'react';
import type { Period } from '@/types/bank';
import { useBankData } from '@/contexts/BankDataContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PeriodSelector } from '@/components/PeriodSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BankCalendar } from '@/components/BankCalendar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchWeeklyData } from '@/services/stockService';

const Charts = () => {
  const { banksData, loading, lastUpdated, fetchData } = useBankData();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('year');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    if (selectedBanks.length === 0 && banksData.length > 0) {
      setSelectedBanks([banksData[0].ticker, banksData[1]?.ticker].filter(Boolean));
    }
  }, [banksData]);

  useEffect(() => {
    const loadChartData = async () => {
      if (selectedBanks.length === 0 || selectedPeriod === 'today') return;
      
      setLoadingChart(true);
      try {
        const allData: { [key: string]: { date: string; price: number }[] } = {};
        
        for (const ticker of selectedBanks) {
          const data = await fetchWeeklyData(ticker, selectedPeriod as 'month' | 'ytd' | 'year');
          allData[ticker] = data;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const dates = allData[selectedBanks[0]]?.map(d => d.date) || [];
        const formattedData = dates.map((date, index) => {
          const dataPoint: any = { date };
          selectedBanks.forEach(ticker => {
            const bank = banksData.find(b => b.ticker === ticker);
            if (bank && allData[ticker]?.[index]) {
              dataPoint[bank.name] = allData[ticker][index].price;
            }
          });
          return dataPoint;
        });
        
        setChartData(formattedData);
      } catch (error) {
        console.error('Error loading chart data:', error);
      } finally {
        setLoadingChart(false);
      }
    };

    loadChartData();
  }, [selectedBanks, selectedPeriod, banksData]);

  const toggleBank = (ticker: string) => {
    setSelectedBanks(prev => 
      prev.includes(ticker) 
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
  };

  const toggleSelectAll = () => {
    if (selectedBanks.length === banksData.length) {
      setSelectedBanks([]);
    } else {
      setSelectedBanks(banksData.map(b => b.ticker));
    }
  };

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--success))',
    'hsl(var(--destructive))',
    'hsl(var(--accent))',
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7c7c',
    '#8dd1e1',
    '#d084d0'
  ];

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
                <h2 className="text-2xl font-semibold">Ukentlig Kursutvikling</h2>
                <PeriodSelector 
                  selected={selectedPeriod} 
                  onChange={setSelectedPeriod}
                  excludeToday={true}
                />
              </div>

              {selectedPeriod === 'today' ? (
                <div className="text-center py-8 text-muted-foreground">
                  Velg en annen periode for å se ukentlig utvikling
                </div>
              ) : loadingChart ? (
                <div className="text-center py-8">Laster data...</div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: 'Kurs (NOK)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(2)} NOK`}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    {selectedBanks.map((ticker, index) => {
                      const bank = banksData.find(b => b.ticker === ticker);
                      return bank ? (
                        <Line 
                          key={ticker}
                          type="monotone" 
                          dataKey={bank.name}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ) : null;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Velg banker å sammenligne</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedBanks.length === banksData.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="font-medium cursor-pointer">
                    Velg alle
                  </Label>
                </div>
              </div>
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
            <BankCalendar tickers={selectedBanks} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;