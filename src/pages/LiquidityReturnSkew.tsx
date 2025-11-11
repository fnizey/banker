import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface LARSData {
  date: string;
  lars: number;
  skewness: number;
  avgNormalizedTurnover: number;
}

const LiquidityReturnSkew = () => {
  const [larsData, setLarsData] = useState<LARSData[]>([]);
  const [currentLARS, setCurrentLARS] = useState<LARSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<30 | 90 | 180 | 365>(90);
  const { toast } = useToast();

  const fetchLARSData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-lars', {
        body: { days: selectedDays },
      });

      if (error) throw error;

      setLarsData(data.larsTimeSeries);
      setCurrentLARS(data.currentLARS);
    } catch (error) {
      console.error('Error fetching LARS:', error);
      toast({
        title: 'Feil ved henting av LARS',
        description: 'Kunne ikke hente data. Prøv igjen senere.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLARSData();
  }, [selectedDays]);

  const getInterpretation = (lars: number | null) => {
    if (!lars) return { text: 'Ingen data', color: 'text-muted-foreground', sentiment: 'Ukjent' };
    if (lars > 0.5) return { 
      text: 'Stealth akkumulering (asymmetrisk oppside under lav likviditet)', 
      color: 'text-green-500',
      sentiment: 'Risk-on' 
    };
    if (lars < -0.5) return { 
      text: 'De-risking / defensiv kapitalflyt under lav likviditet', 
      color: 'text-red-500',
      sentiment: 'Risk-off' 
    };
    return { 
      text: 'Balansert asymmetri i avkastning', 
      color: 'text-blue-500',
      sentiment: 'Nøytral' 
    };
  };

  const interpretation = getInterpretation(currentLARS?.lars ?? null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Liquidity-Adjusted Return Skew (LARS)</h1>
            <p className="text-muted-foreground">
              Identifiserer asymmetriske bevegelser under lav likviditet
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
          </div>
        </div>

        {/* Current LARS Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Nåværende LARS</h3>
            {loading && !currentLARS ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentLARS?.lars.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Skewness</h3>
            {loading && !currentLARS ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentLARS?.skewness.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Sentiment</h3>
            {loading && !currentLARS ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className={`text-2xl font-bold ${interpretation.color}`}>{interpretation.sentiment}</p>
            )}
          </Card>
        </div>

        {/* Interpretation Card */}
        <Card className="p-6 mb-8 bg-muted/50">
          <h3 className="text-lg font-semibold mb-2">Tolkning</h3>
          <p className={`font-medium ${interpretation.color}`}>{interpretation.text}</p>
        </Card>

        {/* LARS Time Series Chart */}
        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
          <h2 className="text-2xl font-bold mb-4">LARS over tid ({selectedDays} dager)</h2>
          {loading && larsData.length === 0 ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={larsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  label={{ value: 'LARS', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(3)}`, 'LARS']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine y={0.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" label="Risk-on" />
                <ReferenceLine y={-0.5} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Risk-off" />
                <Line 
                  type="monotone" 
                  dataKey="lars" 
                  name="LARS"
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
          <h3 className="text-lg font-semibold mb-2">Om LARS</h3>
          <p className="text-muted-foreground">
            LARS måler asymmetriske bevegelser i avkastning justert for likviditet. Positive verdier indikerer stealth akkumulering 
            (risk-on sentiment) hvor det er asymmetrisk oppside under lav likviditet. Negative verdier indikerer de-risking eller 
            defensiv kapitalflyt. LARS kombinerer cross-sectional skewness med normalisert omsetning for å fange opp skjulte 
            markedsbevegelser.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default LiquidityReturnSkew;
