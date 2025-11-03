import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBankData } from '@/contexts/BankDataContext';
import { useSearch } from '@/contexts/SearchContext';
import { cn } from '@/lib/utils';

export const SearchBar = () => {
  const { banksData } = useBankData();
  const { selectedBankTicker, setSelectedBankTicker, searchQuery, setSearchQuery } = useSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [filteredBanks, setFilteredBanks] = useState(banksData);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery) {
      const filtered = banksData.filter(bank => 
        bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bank.ticker.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBanks(filtered);
      setIsOpen(true);
    } else {
      setFilteredBanks(banksData);
      setIsOpen(false);
    }
  }, [searchQuery, banksData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBankSelect = (ticker: string) => {
    setSelectedBankTicker(ticker);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    setSelectedBankTicker(null);
    setSearchQuery('');
  };

  const selectedBank = banksData.find(b => b.ticker === selectedBankTicker);

  return (
    <div className="relative" ref={searchRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Søk etter bank eller ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery && setIsOpen(true)}
            className="pl-10 pr-4 bg-card/50 border-border/50 focus:bg-card"
          />
        </div>

        {selectedBank && (
          <Badge 
            variant="secondary" 
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
          >
            <span className="font-medium">{selectedBank.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              className="h-4 w-4 p-0 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>

      {isOpen && filteredBanks.length > 0 && (
        <div className="absolute top-full mt-2 w-full max-w-md bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {filteredBanks.map((bank) => (
            <button
              key={bank.ticker}
              onClick={() => handleBankSelect(bank.ticker)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent/10 transition-colors border-b border-border/50 last:border-0",
                "flex items-center justify-between group"
              )}
            >
              <div>
                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {bank.name}
                </div>
                <div className="text-sm text-muted-foreground">{bank.ticker}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{bank.currentPrice.toFixed(2)} NOK</div>
                <div className={cn(
                  "text-sm font-medium",
                  bank.todayChange >= 0 ? "text-success" : "text-destructive"
                )}>
                  {bank.todayChange >= 0 ? '+' : ''}{bank.todayChange.toFixed(2)}%
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchQuery && filteredBanks.length === 0 && (
        <div className="absolute top-full mt-2 w-full max-w-md bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center text-muted-foreground">
          Ingen banker funnet
        </div>
      )}
    </div>
  );
};
