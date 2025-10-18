import { useBankData } from '@/contexts/BankDataContext';
import { Button } from '@/components/ui/button';
import { Table as TableUI, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation } from '@/components/Navigation';

const Table = () => {
  const { banksData, loading, lastUpdated, fetchData } = useBankData();

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-success' : 'text-destructive';
  };

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

        <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Alle banker - oversikt</h2>
              
              {loading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <TableUI>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead className="text-right">Kurs</TableHead>
                      <TableHead className="text-right">I dag</TableHead>
                      <TableHead className="text-right">Siste måned</TableHead>
                      <TableHead className="text-right">Hittil i år</TableHead>
                      <TableHead className="text-right">Siste år</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banksData.map((bank) => (
                      <TableRow key={bank.ticker}>
                        <TableCell className="font-medium">{bank.name}</TableCell>
                        <TableCell className="text-muted-foreground">{bank.ticker}</TableCell>
                        <TableCell className="text-right">{bank.currentPrice.toFixed(2)} NOK</TableCell>
                        <TableCell className={`text-right font-medium ${getChangeColor(bank.todayChange)}`}>
                          {formatChange(bank.todayChange)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getChangeColor(bank.monthChange)}`}>
                          {formatChange(bank.monthChange)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getChangeColor(bank.ytdChange)}`}>
                          {formatChange(bank.ytdChange)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getChangeColor(bank.yearChange)}`}>
                          {formatChange(bank.yearChange)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://live.euronext.com/en/product/equities/${bank.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableUI>
              )}

          {lastUpdated && (
            <p className="text-sm text-muted-foreground mt-4">
              Sist oppdatert: {lastUpdated.toLocaleString('nb-NO')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Table;
