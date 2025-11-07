import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface DispersionData {
  date: string;
  dispersion: number;
}

interface PerformerData {
  ticker: string;
  name: string;
  dailyReturn: number;
}

const CrossSectionalDispersion = () => {
  const [dispersionData, setDispersionData] = useState<DispersionData[]>([]);
  const [currentDispersion, setCurrentDispersion] = useState<number>(0);
  const [topPerformers, setTopPerformers] = useState<PerformerData[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<PerformerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchDispersionData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-dispersion', {
        body: { days: 90 }
      });

      if (error) throw error;

      if (data.success) {
        setDispersionData(data.dispersionTimeSeries);
        setCurrentDispersion(data.currentDispersion);
        setTopPerformers(data.topPerformers);
        setBottomPerformers(data.bottomPerformers);
        setLastUpdated(new Date());
        
        toast({
          title: "Data hentet",
          description: "Spredningsanalyse oppdatert",
        });
      }
    } catch (error) {
      console.error('Error fetching dispersion data:', error);
      toast({
        title: "Feil ved henting",
        description: "Kunne ikke laste spredningsdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispersionData();
  }, []);

  const getInterpretation = (dispersion: number) => {
    if (dispersion < 0.4) {
      return {
        text: "Lav spredning - bankene beveger seg i takt (sektorhandel)",
        color: "text-success",
        icon: <TrendingUp className="w-5 h-5" />
      };
    } else if (dispersion > 1.0) {
      return {
        text: "Høy spredning - sterk rotasjon / divergerende ytelse",
        color: "text-destructive",
        icon: <TrendingDown className="w-5 h-5" />
      };
    } else {
      return {
        text: "Moderat spredning - normal markedsatferd",
        color: "text-muted-foreground",
        icon: <TrendingUp className="w-5 h-5" />
      };
    }
  };

  const interpretation = getInterpretation(currentDispersion);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              📊 Cross-Sectional Dispersion
            </h1>
            <p className="text-muted-foreground mt-2">
              Måler hvor spredt daglige avkastninger er på tvers av alle banker
            </p>
          </div>
          <Button onClick={fetchDispersionData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <div className="space-y-6">
          {/* Current Dispersion Metric */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">
                  Dagens spredningsindeks
                </h2>
                <div className="text-4xl font-bold">
                  {currentDispersion.toFixed(2)}%
                </div>
              </div>
              <div className={`flex items-center gap-2 ${interpretation.color}`}>
                {interpretation.icon}
                <span className="text-sm font-medium max-w-xs">
                  {interpretation.text}
                </span>
              </div>
            </div>
          </Card>

          {/* Dispersion Time Series Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
            <h2 className="text-2xl font-bold mb-4">Sektorspredningsindeks (90 dager)</h2>
            {loading && dispersionData.length === 0 ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dispersionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    label={{ value: 'Spredning (%)', angle: -90, position: 'insideLeft' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(3)}%`, 'Spredning']}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="dispersion" 
                    name="Spredningsindeks"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top and Bottom Performers */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-success/5 to-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success" />
                <h3 className="text-xl font-bold">Best i dag</h3>
              </div>
              <div className="space-y-3">
                {topPerformers.map((performer, index) => (
                  <div key={performer.ticker} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{performer.name}</div>
                        <div className="text-sm text-muted-foreground">{performer.ticker}</div>
                      </div>
                    </div>
                    <div className="text-success font-bold">
                      +{performer.dailyReturn.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bottom Performers */}
            <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-destructive/5 to-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-destructive" />
                <h3 className="text-xl font-bold">Dårligst i dag</h3>
              </div>
              <div className="space-y-3">
                {bottomPerformers.map((performer, index) => (
                  <div key={performer.ticker} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{performer.name}</div>
                        <div className="text-sm text-muted-foreground">{performer.ticker}</div>
                      </div>
                    </div>
                    <div className="text-destructive font-bold">
                      {performer.dailyReturn.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {lastUpdated && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
              Oppdatert: {lastUpdated.toLocaleString('nb-NO')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrossSectionalDispersion;
