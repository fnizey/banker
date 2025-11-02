import { FinancialReports } from '@/components/FinancialReports';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useBankData } from '@/contexts/BankDataContext';
import { Navigation } from '@/components/Navigation';

const Reports = () => {
  const { loading, fetchData } = useBankData();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold">📊 Finansielle rapporter</h1>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <Navigation />

        <FinancialReports />
      </div>
    </div>
  );
};

export default Reports;
