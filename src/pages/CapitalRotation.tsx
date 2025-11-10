import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface RotationData {
  date: string;
  returnRotation: number;
  turnoverRotation: number;
  combinedRotation: number;
}

interface BankInfo {
  name: string;
  ticker: string;
}

interface BanksByCategory {
  Small: BankInfo[];
  Mid: BankInfo[];
  Large: BankInfo[];
}

const CapitalRotation = () => {
  const [rotationData, setRotationData] = useState<RotationData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<any>(null);
  const [banksByCategory, setBanksByCategory] = useState<BanksByCategory>({ Small: [], Mid: [], Large: [] });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchRotationData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-rotation');

      if (error) throw error;

      if (data.success) {
        setRotationData(data.rotationTimeSeries);
        setCurrentMetrics(data.currentMetrics);
        setBanksByCategory(data.banksByCategory);
        setLastUpdated(new Date());
        
        toast({
          title: "Data hentet",
          description: "Rotasjonsanalyse oppdatert",
        });
      }
    } catch (error) {
      console.error('Error fetching rotation data:', error);
      toast({
        title: "Feil ved henting",
        description: "Kunne ikke laste rotasjonsdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRotationData();
  }, []);

  const getInterpretation = (value: number) => {
    if (value > 0.5) {
      return {
        text: "Sterk kapitalflyt mot store banker (risk-off sentiment)",
        color: "text-destructive",
        icon: <ArrowUpRight className="w-5 h-5" />
      };
    } else if (value < -0.5) {
      return {
        text: "Sterk kapitalflyt mot små banker (risk-on sentiment)",
        color: "text-success",
        icon: <ArrowDownRight className="w-5 h-5" />
      };
    } else {
      return {
        text: "Balansert kapitalflyt",
        color: "text-muted-foreground",
        icon: <TrendingUp className="w-5 h-5" />
      };
    }
  };

  const combinedInterpretation = currentMetrics ? getInterpretation(currentMetrics.combinedRotation) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              🔄 Kapitalrotasjon
            </h1>
            <p className="text-muted-foreground mt-2">
              Måler kapitalflyt mellom store og små banker basert på avkastning og normalisert omsetning
            </p>
          </div>
          <Button onClick={fetchRotationData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <div className="space-y-6">
          {/* Current Metrics Cards */}
          {currentMetrics && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card to-primary/5">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Avkastningsrotasjon
                </div>
                <div className="text-3xl font-bold">
                  {currentMetrics.returnRotation.toFixed(3)}%
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Stor - Liten avkastning
                </div>
              </Card>

              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card to-accent/5">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Omsetningsrotasjon
                </div>
                <div className="text-3xl font-bold">
                  {currentMetrics.turnoverRotation.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Normalisert omsetning (Stor - Liten)
                </div>
              </Card>

              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card to-success/5">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Kombinert rotasjonsindeks
                </div>
                <div className="text-3xl font-bold">
                  {currentMetrics.combinedRotation.toFixed(2)}
                </div>
                {combinedInterpretation && (
                  <div className={`flex items-center gap-2 mt-2 text-xs ${combinedInterpretation.color}`}>
                    {combinedInterpretation.icon}
                    <span>{combinedInterpretation.text}</span>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Return Rotation Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <h2 className="text-2xl font-bold mb-4">Avkastningsrotasjon (Stor - Liten)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Positiv verdi → kapital mot store banker (risk-off) | Negativ verdi → kapital mot små banker (risk-on)
            </p>
            {loading && rotationData.length === 0 ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rotationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(3)}%`, 'Rotasjon']}
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
                    dataKey="returnRotation" 
                    name="Avkastningsrotasjon"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Turnover Rotation Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
            <h2 className="text-2xl font-bold mb-4">Omsetningsrotasjon (normalisert)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Positiv verdi → store banker handles mer enn normalt | Negativ verdi → små banker handles mer enn normalt
            </p>
            {loading && rotationData.length === 0 ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rotationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(3), 'Rotasjon']}
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
                    dataKey="turnoverRotation" 
                    name="Omsetningsrotasjon"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Combined Rotation Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-success/5">
            <h2 className="text-2xl font-bold mb-4">Kombinert rotasjonsindeks (z-score)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Kombinerer avkastning og omsetning. Positiv → risk-off | Negativ → risk-on
            </p>
            {loading && rotationData.length === 0 ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rotationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(2), 'Z-score']}
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
                    dataKey="combinedRotation" 
                    name="Kombinert rotasjon"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bank Categories */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-primary/5 to-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <h3 className="text-xl font-bold">Små banker (&lt;10 mrd)</h3>
              </div>
              <div className="space-y-2">
                {banksByCategory.Small.map((bank) => (
                  <div key={bank.ticker} className="flex justify-between text-sm p-2 bg-card rounded border">
                    <span className="font-medium">{bank.name}</span>
                    <span className="text-muted-foreground">{bank.ticker}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-accent/5 to-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-accent" />
                <h3 className="text-xl font-bold">Mellomstore (10-50 mrd)</h3>
              </div>
              <div className="space-y-2">
                {banksByCategory.Mid.map((bank) => (
                  <div key={bank.ticker} className="flex justify-between text-sm p-2 bg-card rounded border">
                    <span className="font-medium">{bank.name}</span>
                    <span className="text-muted-foreground">{bank.ticker}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-success/5 to-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-success" />
                <h3 className="text-xl font-bold">Store banker (≥50 mrd)</h3>
              </div>
              <div className="space-y-2">
                {banksByCategory.Large.map((bank) => (
                  <div key={bank.ticker} className="flex justify-between text-sm p-2 bg-card rounded border">
                    <span className="font-medium">{bank.name}</span>
                    <span className="text-muted-foreground">{bank.ticker}</span>
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

export default CapitalRotation;
