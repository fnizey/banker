import { createContext, useContext, useState, ReactNode } from 'react';
import { BankData } from '@/types/bank';
import { BANKS } from '@/types/bank';
import { fetchAllBanksData } from '@/services/stockService';
import { toast } from 'sonner';

interface BankDataContextType {
  banksData: BankData[];
  loading: boolean;
  lastUpdated: Date | null;
  progress: { 
    phase: 'banks' | 'indicators'; 
    completed: number; 
    total: number; 
    currentIndicator: string;
  };
  fetchData: () => Promise<void>;
}

const BankDataContext = createContext<BankDataContextType | undefined>(undefined);

export const BankDataProvider = ({ children }: { children: ReactNode }) => {
  const [banksData, setBanksData] = useState<BankData[]>(() => {
    const stored = localStorage.getItem('banksData');
    return stored ? JSON.parse(stored) : [];
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const stored = localStorage.getItem('lastUpdated');
    return stored ? new Date(stored) : null;
  });
  const [progress, setProgress] = useState<{ 
    phase: 'banks' | 'indicators'; 
    completed: number; 
    total: number; 
    currentIndicator: string;
  }>({ 
    phase: 'banks', 
    completed: 0, 
    total: 0, 
    currentIndicator: '' 
  });

  const updateIndicators = async () => {
    const indicators = [
      { name: 'SSI', function: 'calculate-ssi', days: 365 },
      { name: 'LARS', function: 'calculate-lars', days: 365 },
      { name: 'VDI', function: 'calculate-vdi', days: 365 },
      { name: 'Rotation', function: 'calculate-rotation', days: 365 },
      { name: 'SMFI', function: 'calculate-smfi', days: 365 },
      { name: 'Regime Correlation', function: 'calculate-regime-correlation', days: 180 },
      { name: 'Dispersion', function: 'calculate-dispersion', days: 365 },
      { name: 'Performance', function: 'calculate-performance', days: 365 },
      { name: 'Abnormal Volume', function: 'calculate-abnormal-volume', days: 365 },
      { name: 'Outlier Radar', function: 'calculate-outlier-radar', days: 365 },
      { name: 'Alpha Engine', function: 'calculate-alpha-engine', days: 365 }
    ];
    
    setProgress({ phase: 'indicators', completed: 0, total: indicators.length, currentIndicator: '' });
    toast.info('Oppdaterer indikatorer...');
    
    for (let i = 0; i < indicators.length; i++) {
      const indicator = indicators[i];
      setProgress({ 
        phase: 'indicators', 
        completed: i, 
        total: indicators.length, 
        currentIndicator: indicator.name 
      });
      
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.functions.invoke(indicator.function, {
          body: { days: indicator.days }
        });
        console.log(`✓ ${indicator.name} oppdatert`);
      } catch (error) {
        console.error(`✗ Feil ved oppdatering av ${indicator.name}:`, error);
        // Fortsett med neste indikator selv om en feiler
      }
    }
    
    setProgress({ phase: 'indicators', completed: indicators.length, total: indicators.length, currentIndicator: '' });
    toast.success('Alle indikatorer oppdatert!');
  };

  const fetchData = async () => {
    setLoading(true);
    setProgress({ phase: 'banks', completed: 0, total: BANKS.length, currentIndicator: '' });
    toast.info('Henter data for alle banker...');
    
    try {
      const data = await fetchAllBanksData(BANKS, (completed, total) => {
        setProgress({ phase: 'banks', completed, total, currentIndicator: '' });
      });
      
      setBanksData(data);
      const now = new Date();
      setLastUpdated(now);
      
      // Persist to localStorage
      localStorage.setItem('banksData', JSON.stringify(data));
      localStorage.setItem('lastUpdated', now.toISOString());
      
      toast.success(`Oppdatert data for ${data.length} banker`);
      
      // FASE 2: Oppdater alle indikatorer
      await updateIndicators();
      
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
