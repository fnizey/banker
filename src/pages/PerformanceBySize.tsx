import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceData {
  date: string;
  Small: number;
  Mid: number;
  Large: number;
}

interface BankInfo {
  name: string;
  ticker: string;
  marketCap: number;
}

interface BanksByCategory {
  Small: BankInfo[];
  Mid: BankInfo[];
  Large: BankInfo[];
}

type Period = '30' | '90' | '180' | 'ytd' | '365';

const PerformanceBySize = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [currentPerformance, setCurrentPerformance] = useState<any>(null);
  const [banksByCategory, setBanksByCategory] = useState<BanksByCategory>({ Small: [], Mid: [], Large: [] });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('90');
  const { toast } = useToast();

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-performance');

      if (error) throw error;

      if (data.success) {
        setPerformanceData(data.performanceTimeSeries);
        setCurrentPerformance(data.currentPerformance);
        setBanksByCategory(data.banksByCategory);
        setLastUpdated(new Date());
        
        toast({
          title: "Data hentet",
          description: "Ytelsesanalyse oppdatert",
        });
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast({
        title: "Feil ved henting",
        description: "Kunne ikke laste ytelsesdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const getFilteredData = () => {
    if (!performanceData.length) return [];

    const now = new Date();
    let startDate: Date;

    switch (selectedPeriod) {
      case '30':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '180':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '365':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return performanceData;
    }

    const filtered = performanceData.filter(d => new Date(d.date) >= startDate);
    
    // Re-base the cumulative returns to start from 0 at the beginning of the selected period
    if (filtered.length === 0) return [];
    
    const firstValues = {
      Small: filtered[0].Small,
      Mid: filtered[0].Mid,
      Large: filtered[0].Large,
    };
    
    return filtered.map(d => ({
      ...d,
      Small: d.Small - firstValues.Small,
      Mid: d.Mid - firstValues.Mid,
      Large: d.Large - firstValues.Large,
    }));
  };

  const filteredData = getFilteredData();
  
  // Calculate current performance from filtered data
  const filteredCurrentPerformance = filteredData.length > 0 
    ? filteredData[filteredData.length - 1]
    : null;

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case '30': return 'Siste måned (30 dager)';
      case '90': return 'Siste 3 måneder (90 dager)';
      case '180': return 'Siste 6 måneder (180 dager)';
      case 'ytd': return 'Hittil i år (YTD)';
      case '365': return 'Siste 12 måneder';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              📈 Relativ Ytelse
            </h1>
            <p className="text-muted-foreground mt-2">
              Sammenlign akkumulert avkastning for små, mellomstore og store banker
            </p>
          </div>
          <Button onClick={fetchPerformanceData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <div className="space-y-6">
          {/* Period Selector */}
          <Card className="p-6 shadow-lg border-2">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Velg periode:</label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as Period)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Siste måned (30 d)</SelectItem>
                  <SelectItem value="90">Siste 3 måneder (90 d)</SelectItem>
                  <SelectItem value="180">Siste 6 måneder (180 d)</SelectItem>
                  <SelectItem value="ytd">Hittil i år (YTD)</SelectItem>
                  <SelectItem value="365">Siste 12 måneder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Performance Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <h2 className="text-2xl font-bold mb-4">Akkumulert avkastning - {getPeriodLabel()}</h2>
            {loading && performanceData.length === 0 ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    label={{ value: 'Avkastning (%)', angle: -90, position: 'insideLeft' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
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
                    dataKey="Small" 
                    name="Små banker"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Mid" 
                    name="Mellomstore"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Large" 
                    name="Store banker"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Current Performance Cards */}
          {filteredCurrentPerformance && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-primary/5 to-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <div className="text-sm font-medium text-muted-foreground">
                    Små banker
                  </div>
                </div>
                <div className="text-3xl font-bold">
                  {filteredCurrentPerformance.Small.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {getPeriodLabel()}
                </div>
              </Card>

              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-accent/5 to-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <div className="text-sm font-medium text-muted-foreground">
                    Mellomstore
                  </div>
                </div>
                <div className="text-3xl font-bold">
                  {filteredCurrentPerformance.Mid.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {getPeriodLabel()}
                </div>
              </Card>

              <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-success/5 to-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <div className="text-sm font-medium text-muted-foreground">
                    Store banker
                  </div>
                </div>
                <div className="text-3xl font-bold">
                  {filteredCurrentPerformance.Large.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {getPeriodLabel()}
                </div>
              </Card>
            </div>
          )}

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

export default PerformanceBySize;
