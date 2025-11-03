import { useState } from 'react';
import { useBankData } from '@/contexts/BankDataContext';
import { useSearch } from '@/contexts/SearchContext';
import { Button } from '@/components/ui/button';
import { Table as TableUI, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { RefreshCw, ExternalLink, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation } from '@/components/Navigation';
import type { BankData } from '@/types/bank';

type SortField = 'name' | 'todayChange' | 'monthChange' | 'ytdChange' | 'yearChange';
type SortDirection = 'asc' | 'desc';

const Table = () => {
  const { banksData, loading, lastUpdated, fetchData } = useBankData();
  const { selectedBankTicker } = useSearch();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter banks based on search
  const filteredBanks = selectedBankTicker 
    ? banksData.filter(bank => bank.ticker === selectedBankTicker)
    : banksData;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedBanks = [...filteredBanks].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField === 'name') {
      aValue = a.name;
      bValue = b.name;
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue, 'nb-NO')
        : bValue.localeCompare(aValue, 'nb-NO');
    }

    return sortDirection === 'asc' 
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

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
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {selectedBankTicker 
                ? `${filteredBanks[0]?.name || 'Bank'} - Detaljert tabell`
                : '📊 Sparebank-dashboard – Oslo Børs'}
            </h1>
            {selectedBankTicker && (
              <p className="text-muted-foreground mt-2">Viser kun data for {filteredBanks[0]?.name}</p>
            )}
          </div>
          <Button onClick={fetchData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <Navigation />

        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
              <h2 className="text-2xl font-bold mb-4">
                {selectedBankTicker ? `${filteredBanks[0]?.name} - Alle nøkkeltall` : 'Alle banker - oversikt'}
              </h2>
              
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
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('name')}
                        className="hover:bg-transparent p-0 h-auto font-bold"
                      >
                        Bank <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                      </Button>
                    </TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Kurs</TableHead>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('todayChange')}
                        className="hover:bg-transparent p-0 h-auto font-bold"
                      >
                        I dag <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('monthChange')}
                        className="hover:bg-transparent p-0 h-auto font-bold"
                      >
                        Siste måned <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('ytdChange')}
                        className="hover:bg-transparent p-0 h-auto font-bold"
                      >
                        Hittil i år <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('yearChange')}
                        className="hover:bg-transparent p-0 h-auto font-bold"
                      >
                        Siste år <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                      </Button>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBanks.map((bank) => (
                      <TableRow key={bank.ticker} className="hover:bg-accent/5 transition-colors">
                        <TableCell className="font-medium">{bank.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono">{bank.ticker}</TableCell>
                        <TableCell className="text-right font-bold">{bank.currentPrice.toFixed(2)} NOK</TableCell>
                        <TableCell className={`text-right font-bold ${getChangeColor(bank.todayChange)}`}>
                          {formatChange(bank.todayChange)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getChangeColor(bank.monthChange)}`}>
                          {formatChange(bank.monthChange)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getChangeColor(bank.ytdChange)}`}>
                          {formatChange(bank.ytdChange)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getChangeColor(bank.yearChange)}`}>
                          {formatChange(bank.yearChange)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://finance.yahoo.com/quote/${bank.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-accent transition-colors"
                            title="Se på Yahoo Finance"
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
            <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
              <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
              Sist oppdatert: {lastUpdated.toLocaleString('nb-NO')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Table;
