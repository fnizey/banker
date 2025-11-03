import { createContext, useContext, useState, ReactNode } from 'react';

interface SearchContextType {
  selectedBankTicker: string | null;
  setSelectedBankTicker: (ticker: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBankTicker, setSelectedBankTicker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SearchContext.Provider value={{ 
      selectedBankTicker, 
      setSelectedBankTicker,
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
