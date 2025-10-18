import { createContext, useContext, useState, ReactNode } from 'react';
import { BankData } from '@/types/bank';
import { BANKS } from '@/types/bank';
import { fetchAllBanksData } from '@/services/stockService';
import { toast } from 'sonner';

interface BankDataContextType {
  banksData: BankData[];
  loading: boolean;
  lastUpdated: Date | null;
  progress: { completed: number; total: number };
  fetchData: () => Promise<void>;
}

const BankDataContext = createContext<BankDataContextType | undefined>(undefined);

export const BankDataProvider = ({ children }: { children: ReactNode }) => {
  const [banksData, setBanksData] = useState<BankData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const fetchData = async () => {
    setLoading(true);
    setProgress({ completed: 0, total: BANKS.length });
    toast.info('Henter data for alle banker...');
    
    try {
      const data = await fetchAllBanksData(BANKS, (completed, total) => {
        setProgress({ completed, total });
      });
      
      setBanksData(data);
      setLastUpdated(new Date());
      toast.success(`Oppdatert data for ${data.length} banker`);
    } catch (error) {
      toast.error('Kunne ikke hente data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BankDataContext.Provider value={{ banksData, loading, lastUpdated, progress, fetchData }}>
      {children}
    </BankDataContext.Provider>
  );
};

export const useBankData = () => {
  const context = useContext(BankDataContext);
  if (!context) {
    throw new Error('useBankData must be used within BankDataProvider');
  }
  return context;
};
