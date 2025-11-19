import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { exportToExcel } from '@/utils/excelExport';

interface VDIData {
  date: string;
  vdi: number;
  volatilityRatio: number;
  turnoverRatio: number;
}

const VolatilityDivergence = () => {
  const [vdiData, setVdiData] = useState<VDIData[]>([]);
  const [currentVDI, setCurrentVDI] = useState<VDIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<30 | 90 | 180 | 365>(90);
  const { toast } = useToast();

  const fetchVDIData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-vdi', {
        body: { days: selectedDays },
      });

      if (error) throw error;

      setVdiData(data.vdiTimeSeries);
      setCurrentVDI(data.currentVDI);
    } catch (error) {
      console.error('Error fetching VDI:', error);
      toast({
        title: 'Feil ved henting av VDI',
        description: 'Kunne ikke hente data. Prøv igjen senere.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVDIData();
  }, [selectedDays]);

  const handleExport = () => {
    if (!vdiData || vdiData.length === 0) return;
    
    const exportData = vdiData.map(d => ({
      Dato: d.date,
      VDI: d.vdi.toFixed(3),
      'Volatility Ratio': d.volatilityRatio.toFixed(3),
      'Turnover Ratio': d.turnoverRatio.toFixed(3),
    }));
    
    exportToExcel(exportData, `VDI_${selectedDays}dager`, 'Volatility Divergence');
  };

  const getInterpretation = (vdi: number | null) => {
    if (!vdi) return { text: 'Ingen data', color: 'text-muted-foreground' };
    if (vdi > 1.2) return { text: 'Høy stress i småbanker (volatilitet > likviditet)', color: 'text-red-500' };
    if (vdi < 0.8) return { text: 'Institusjonell reposisjonering (likviditet > volatilitet)', color: 'text-blue-500' };
    return { text: 'Balansert volatilitet og likviditet', color: 'text-green-500' };
  };

  const interpretation = getInterpretation(currentVDI?.vdi ?? null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Volatility Divergence Index (VDI)</h1>
            <p className="text-muted-foreground">
              Oppdager divergens mellom volatilitet og handelsaktivitet
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={selectedDays === 30 ? "default" : "outline"}
              onClick={() => setSelectedDays(30)}
              disabled={loading}
            >
              30 dager
            </Button>
            <Button 
              variant={selectedDays === 90 ? "default" : "outline"}
              onClick={() => setSelectedDays(90)}
              disabled={loading}
            >
              90 dager
            </Button>
            <Button 
              variant={selectedDays === 180 ? "default" : "outline"}
              onClick={() => setSelectedDays(180)}
              disabled={loading}
            >
              180 dager
            </Button>
            <Button 
              variant={selectedDays === 365 ? "default" : "outline"}
              onClick={() => setSelectedDays(365)}
              disabled={loading}
            >
              365 dager
            </Button>
            <Button onClick={handleExport} disabled={!vdiData || vdiData.length === 0} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Last ned Excel
            </Button>
          </div>
        </div>

        {/* Current VDI Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Nåværende VDI</h3>
            {loading && !currentVDI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentVDI?.vdi.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Volatilitetsratio</h3>
            {loading && !currentVDI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentVDI?.volatilityRatio.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Omsetningsratio</h3>
            {loading && !currentVDI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentVDI?.turnoverRatio.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
        </div>

        {/* Interpretation Card */}
        <Card className="p-6 mb-8 bg-muted/50">
          <h3 className="text-lg font-semibold mb-2">Tolkning</h3>
          <p className={`font-medium ${interpretation.color}`}>{interpretation.text}</p>
        </Card>

        {/* VDI Time Series Chart */}
        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
          <h2 className="text-2xl font-bold mb-4">VDI over tid ({selectedDays} dager)</h2>
          {loading && vdiData.length === 0 ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={vdiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  label={{ value: 'VDI', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(3)}`, 'VDI']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine y={1.2} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Høy stress" />
                <ReferenceLine y={0.8} stroke="hsl(var(--primary))" strokeDasharray="3 3" label="Reposisjonering" />
                <Line 
                  type="monotone" 
                  dataKey="vdi" 
                  name="VDI"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 mt-8 bg-accent/10">
          <h3 className="text-lg font-semibold mb-2">Om VDI</h3>
          <p className="text-muted-foreground">
            VDI oppdager divergens mellom volatilitet og likviditet. En VDI over 1 indikerer at volatiliteten i småbanker 
            er høyere relativt til deres handelsaktivitet sammenlignet med storbanker, noe som kan signalisere latent stress. 
            En VDI under 1 kan indikere institusjonell reposisjonering der likviditeten er høyere enn forventet gitt volatiliteten.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default VolatilityDivergence;
