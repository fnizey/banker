import { createContext, useContext, useState, ReactNode } from 'react';

interface SearchContextType {
  selectedBankTickers: string[];
  addBankTab: (ticker: string) => void;
  removeBankTab: (ticker: string) => void;
  clearAllTabs: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBankTickers, setSelectedBankTickers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const addBankTab = (ticker: string) => {
    if (!selectedBankTickers.includes(ticker)) {
      setSelectedBankTickers([...selectedBankTickers, ticker]);
    }
  };

  const removeBankTab = (ticker: string) => {
    setSelectedBankTickers(selectedBankTickers.filter(t => t !== ticker));
  };

  const clearAllTabs = () => {
    setSelectedBankTickers([]);
  };

  return (
    <SearchContext.Provider value={{ 
      selectedBankTickers,
      addBankTab,
      removeBankTab,
      clearAllTabs,
      searchQuery,
      setSearchQuery
    }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};
