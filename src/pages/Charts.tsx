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

import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchWeeklyData } from '@/services/stockService';

const Charts = () => {
  const { banksData, loading, lastUpdated, fetchData } = useBankData();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('year');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [referenceBanks, setReferenceBanks] = useState<string[]>([]);
  const [indexedView, setIndexedView] = useState(false);
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
        
        // Fetch data for selected banks
        for (const ticker of selectedBanks) {
          const data = await fetchWeeklyData(ticker, selectedPeriod as 'month' | 'ytd' | 'year');
          allData[ticker] = data;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Fetch data for reference banks if indexed view is enabled
        if (indexedView && referenceBanks.length > 0) {
          for (const ticker of referenceBanks) {
            if (!allData[ticker]) {
              const data = await fetchWeeklyData(ticker, selectedPeriod as 'month' | 'ytd' | 'year');
              allData[ticker] = data;
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
        
        const dates = allData[selectedBanks[0]]?.map(d => d.date) || [];
        const formattedData = dates.map((date, index) => {
          const dataPoint: any = { date };
          
          if (indexedView && referenceBanks.length > 0) {
            // Calculate average reference price
            let referencePrice = 0;
            let validReferences = 0;
            referenceBanks.forEach(ticker => {
              if (allData[ticker]?.[index]?.price) {
                referencePrice += allData[ticker][index].price;
                validReferences++;
              }
            });
            referencePrice = validReferences > 0 ? referencePrice / validReferences : 1;
            
            // Get initial reference price for base 100
            let initialReferencePrice = 0;
            let initialValidReferences = 0;
            referenceBanks.forEach(ticker => {
              if (allData[ticker]?.[0]?.price) {
                initialReferencePrice += allData[ticker][0].price;
                initialValidReferences++;
              }
            });
            initialReferencePrice = initialValidReferences > 0 ? initialReferencePrice / initialValidReferences : 1;
            
            // Calculate indexed values for selected banks
            selectedBanks.forEach(ticker => {
              const bank = banksData.find(b => b.ticker === ticker);
              if (bank && allData[ticker]?.[index]?.price && allData[ticker]?.[0]?.price) {
                const currentPrice = allData[ticker][index].price;
                const initialPrice = allData[ticker][0].price;
                const currentRef = referencePrice;
                const initialRef = initialReferencePrice;
                
                // Index formula: (current_bank/current_ref) / (initial_bank/initial_ref) * 100
                dataPoint[bank.name] = ((currentPrice / currentRef) / (initialPrice / initialRef)) * 100;
              }
            });
          } else {
            // Normal view - show actual prices
            selectedBanks.forEach(ticker => {
              const bank = banksData.find(b => b.ticker === ticker);
              if (bank && allData[ticker]?.[index]) {
                dataPoint[bank.name] = allData[ticker][index].price;
              }
            });
          }
          
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
  }, [selectedBanks, referenceBanks, selectedPeriod, indexedView, banksData]);

  const toggleBank = (ticker: string) => {
    setSelectedBanks(prev => 
      prev.includes(ticker) 
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
  };

  const toggleReferenceBank = (ticker: string) => {
    setReferenceBanks(prev => 
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

  const toggleSelectAllReference = () => {
    if (referenceBanks.length === banksData.length) {
      setReferenceBanks([]);
    } else {
      setReferenceBanks(banksData.map(b => b.ticker));
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

        <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">
                  {indexedView ? 'Indeksert Kursutvikling' : 'Ukentlig Kursutvikling'}
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="indexed-view"
                      checked={indexedView}
                      onCheckedChange={setIndexedView}
                    />
                    <Label htmlFor="indexed-view" className="cursor-pointer">
                      Indeksert visning
                    </Label>
                  </div>
                  <PeriodSelector 
                    selected={selectedPeriod} 
                    onChange={setSelectedPeriod}
                    excludeToday={true}
                  />
                </div>
              </div>

              {indexedView && (
                <div className="mb-4 p-4 bg-accent/50 rounded-lg space-y-2">
                  <p className="text-sm font-semibold">
                    📊 Indeksert visning - Relativ utvikling
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Grafen viser hvordan valgte banker (teller) presterer relativt til gjennomsnittet av referansebankene (nevner).
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <span className="font-medium">100 = Startpunkt</span> - Bank og referanse presterer likt</li>
                    <li>• <span className="font-medium text-success">Over 100</span> - Banken presterer bedre enn referansen</li>
                    <li>• <span className="font-medium text-destructive">Under 100</span> - Banken presterer dårligere enn referansen</li>
                  </ul>
                  {referenceBanks.length === 0 && (
                    <p className="text-sm text-destructive font-medium mt-2">
                      ⚠️ Velg minst én referansebank nedenfor for å se indeksert utvikling.
                    </p>
                  )}
                </div>
              )}

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
                    <YAxis label={{ 
                      value: indexedView ? 'Indeks (100 = start)' : 'Kurs (NOK)', 
                      angle: -90, 
                      position: 'insideLeft' 
                    }} />
                    <Tooltip 
                      formatter={(value: number) => 
                        indexedView 
                          ? [`Indeks: ${value.toFixed(2)}`, ''] 
                          : [`${value.toFixed(2)} NOK`, '']
                      }
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    {selectedBanks.map((ticker, index) => {
                      const bank = banksData.find(b => b.ticker === ticker);
                      const label = indexedView && referenceBanks.length > 0
                        ? `${bank?.name} vs Ref.`
                        : bank?.name;
                      return bank ? (
                        <Line 
                          key={ticker}
                          type="monotone" 
                          dataKey={bank.name}
                          name={label}
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
                <h3 className="text-xl font-semibold">
                  Velg banker å analysere {indexedView && '(Teller)'}
                </h3>
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
              <ScrollArea className="h-[250px]">
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

            {indexedView && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Velg referansebanker (Nevner)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Bankene ovenfor vil sammenlignes mot gjennomsnittet av disse
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-reference"
                      checked={referenceBanks.length === banksData.length}
                      onCheckedChange={toggleSelectAllReference}
                    />
                    <Label htmlFor="select-all-reference" className="font-medium cursor-pointer">
                      Velg alle
                    </Label>
                  </div>
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {banksData.map((bank) => (
                      <div key={`ref-${bank.ticker}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ref-${bank.ticker}`}
                          checked={referenceBanks.includes(bank.ticker)}
                          onCheckedChange={() => toggleReferenceBank(bank.ticker)}
                        />
                        <Label htmlFor={`ref-${bank.ticker}`} className="text-sm cursor-pointer">
                          {bank.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Sist oppdatert: {lastUpdated.toLocaleString('nb-NO')}
              </p>
            )}
        </div>
      </div>
    </div>
  );
};

export default Charts;