import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBankData } from '@/contexts/BankDataContext';
import { fetchFinancialStatements } from '@/services/stockService';
import { FinancialStatement } from '@/types/bank';
import { FileText, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const FinancialReports = () => {
  const { banksData } = useBankData();
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('quarterly');
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFetchReports = async () => {
    if (!selectedBank) {
      toast.error('Velg en bank først');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchFinancialStatements(selectedBank, period);
      setStatements(data);
      if (data.length === 0) {
        toast.info('Ingen finansielle data tilgjengelig');
      }
    } catch (error) {
      toast.error('Kunne ikke hente finansielle rapporter');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number | undefined, decimals = 2) => {
    if (!value) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Finansielle rapporter</h2>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger>
              <SelectValue placeholder="Velg bank" />
            </SelectTrigger>
            <SelectContent>
              {banksData.map(bank => (
                <SelectItem key={bank.ticker} value={bank.ticker}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={(v) => setPeriod(v as 'annual' | 'quarterly')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarterly">Kvartalsvis</SelectItem>
              <SelectItem value="annual">Årlig</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleFetchReports} disabled={loading || !selectedBank}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laster...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Hent rapporter
              </>
            )}
          </Button>
        </div>
      </div>

      {statements.length > 0 && (
        <Tabs defaultValue="income" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income">Resultatregnskap</TabsTrigger>
            <TabsTrigger value="balance">Balanse</TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-semibold">Periode</th>
                    <th className="text-right py-3 px-2 font-semibold">Inntekter</th>
                    <th className="text-right py-3 px-2 font-semibold">Driftsresultat</th>
                    <th className="text-right py-3 px-2 font-semibold">Nettoresultat</th>
                    <th className="text-right py-3 px-2 font-semibold">EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((stmt, idx) => (
                    <tr key={idx} className="border-b hover:bg-accent/50">
                      <td className="py-3 px-2">
                        {new Date(stmt.date).toLocaleDateString('nb-NO', {
                          year: 'numeric',
                          month: 'short',
                          ...(period === 'quarterly' && { day: 'numeric' })
                        })}
                      </td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.revenue)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.operatingIncome)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.netIncome)}</td>
                      <td className="text-right py-3 px-2">{formatNumber(stmt.eps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="balance" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-semibold">Periode</th>
                    <th className="text-right py-3 px-2 font-semibold">Eiendeler</th>
                    <th className="text-right py-3 px-2 font-semibold">Gjeld</th>
                    <th className="text-right py-3 px-2 font-semibold">Egenkapital</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((stmt, idx) => (
                    <tr key={idx} className="border-b hover:bg-accent/50">
                      <td className="py-3 px-2">
                        {new Date(stmt.date).toLocaleDateString('nb-NO', {
                          year: 'numeric',
                          month: 'short',
                          ...(period === 'quarterly' && { day: 'numeric' })
                        })}
                      </td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.totalAssets)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.totalLiabilities)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stmt.equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {statements.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          Velg en bank og klikk "Hent rapporter" for å se finansielle data
        </div>
      )}
    </Card>
  );
};
