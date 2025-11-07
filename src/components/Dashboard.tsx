import { useState } from 'react';
import { BankData, Period } from '@/types/bank';
import { useBankData } from '@/contexts/BankDataContext';
import { useSearch } from '@/contexts/SearchContext';
import { PeriodSelector } from './PeriodSelector';
import { BankCard } from './BankCard';
import { BankDetailTab } from './BankDetailTab';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, TrendingDown, X, Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation } from './Navigation';
import { NewsFeed } from './NewsFeed';
import { CurrencyRates } from './CurrencyRates';
import { SSBNewsFeed } from './SSBNewsFeed';

export const Dashboard = () => {
  const { banksData, loading, lastUpdated, progress, fetchData } = useBankData();
  const { selectedBankTickers, removeBankTab, clearAllTabs } = useSearch();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [activeTab, setActiveTab] = useState('overview');

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

  const selectedBanks = selectedBankTickers
    .map(ticker => banksData.find(bank => bank.ticker === ticker))
    .filter((bank): bank is BankData => bank !== undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              📊 Sparebank-dashboard – Oslo Børs
            </h1>
            <p className="text-muted-foreground mt-2">
              Søk etter en bank for å åpne detaljert analyse
            </p>
          </div>
          <Button onClick={fetchData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <Navigation />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {loading && (
              <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 shadow-lg border-2">
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Laster data: {progress.completed} av {progress.total} banker
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary to-accent h-2.5 rounded-full transition-all duration-300 shadow-glow"
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </Card>
            )}

            {banksData.length === 0 && !loading ? (
              <Card className="p-8 text-center shadow-lg">
                <h3 className="text-xl font-semibold mb-2">Ingen data lastet</h3>
                <p className="text-muted-foreground mb-4">
                  Klikk på "Oppdater data" for å laste inn bankdata
                </p>
                <Button onClick={fetchData} size="lg" className="shadow-md">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Last inn data
                </Button>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-2 bg-card/50 p-2">
                  <TabsTrigger value="overview" className="gap-2">
                    <Home size={16} />
                    Oversikt
                  </TabsTrigger>
                  {selectedBanks.map((bank) => (
                    <TabsTrigger key={bank.ticker} value={bank.ticker} className="gap-2 group">
                      {bank.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBankTab(bank.ticker);
                          if (activeTab === bank.ticker) {
                            setActiveTab('overview');
                          }
                        }}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                  <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 shadow-lg border-2">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
                    </div>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Top Gainers */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-success/10 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-success" />
                        </div>
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
                        <div className="p-2 bg-destructive/10 rounded-lg">
                          <TrendingDown className="w-5 h-5 text-destructive" />
                        </div>
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

                  {lastUpdated && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
                      Sist oppdatert: {lastUpdated.toLocaleString('nb-NO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </TabsContent>

                {selectedBanks.map((bank) => (
                  <TabsContent key={bank.ticker} value={bank.ticker} className="mt-6">
                    <BankDetailTab bank={bank} />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>

          {/* News Feed Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <CurrencyRates />
            <NewsFeed />
            <SSBNewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
};
