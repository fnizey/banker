import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

interface SSIData {
  date: string;
  ssiRaw: number;
  ssiEMA: number;
  ssiCumulative: number;
  components: {
    csd: number;
    rotation: number;
    vdi: number;
    lars: number;
    smfi: number;
    relativePerformance: number;
  };
}

interface SSIResponse {
  ssiTimeSeries: SSIData[];
  currentSSI: SSIData;
  fiveDayChange: number;
  sentiment: string;
  emaStatistics: {
    mean: number;
    stdDev: number;
    upperBand: number;
    lowerBand: number;
  };
  cumulativeStatistics: {
    mean: number;
    stdDev: number;
    upperBand: number;
    lowerBand: number;
    p90: number;
    p10: number;
  };
}

const SectorSentimentIndex = () => {
  const [ssiData, setSsiData] = useState<SSIData[]>([]);
  const [currentSSI, setCurrentSSI] = useState<SSIData | null>(null);
  const [fiveDayChange, setFiveDayChange] = useState<number>(0);
  const [sentiment, setSentiment] = useState<string>('');
  const [emaStats, setEmaStats] = useState<SSIResponse['emaStatistics'] | null>(null);
  const [cumStats, setCumStats] = useState<SSIResponse['cumulativeStatistics'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<30 | 90 | 180 | 365>(90);
  const { toast } = useToast();

  const fetchSSIData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-ssi', {
        body: { days: selectedDays },
      });

      if (error) throw error;

      setSsiData(data.ssiTimeSeries);
      setCurrentSSI(data.currentSSI);
      setFiveDayChange(data.fiveDayChange);
      setSentiment(data.sentiment);
      setEmaStats(data.emaStatistics);
      setCumStats(data.cumulativeStatistics);
    } catch (error) {
      console.error('Error fetching SSI:', error);
      toast({
        title: 'Feil ved henting av SSI',
        description: 'Kunne ikke hente data. Prøv igjen senere.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSSIData();
  }, [selectedDays]);

  const getSentimentColor = (sentiment: string) => {
    if (sentiment.includes('Risk-off') || sentiment.includes('Defensiv')) return 'text-red-500';
    if (sentiment.includes('Risk-on')) return 'text-green-500';
    return 'text-blue-500';
  };

  // Prepare chart data for EMA with color fill
  const emaChartData = ssiData.map(d => ({
    date: d.date,
    ssiEMA: d.ssiEMA,
    positive: d.ssiEMA > 0 ? d.ssiEMA : 0,
    negative: d.ssiEMA < 0 ? d.ssiEMA : 0,
  }));

  // Prepare chart data for Cumulative
  const cumChartData = ssiData.map(d => ({
    date: d.date,
    ssiCumulative: d.ssiCumulative,
  }));

  // Prepare heatmap data (last 10 days)
  const heatmapData = ssiData.slice(-10).map(d => ({
    date: d.date,
    CSD: d.components.csd,
    Rotasjon: d.components.rotation,
    VDI: d.components.vdi,
    LARS: d.components.lars,
    SMFI: d.components.smfi,
    'Relativ Ytelse': d.components.relativePerformance,
  }));

  const getHeatColor = (value: number) => {
    const intensity = Math.min(Math.abs(value), 2) / 2; // cap at ±2σ
    if (value > 0) {
      // Risk-off = red
      return `rgba(239, 68, 68, ${intensity})`;
    } else {
      // Risk-on = green
      return `rgba(34, 197, 94, ${intensity})`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Sector Sentiment Index (SSI)</h1>
            <p className="text-muted-foreground">
              Kombinert sentiment-indikator for norske sparebanker
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

        {/* Current SSI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Nåværende SSI (EMA)</h3>
            {loading && !currentSSI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">
                {currentSSI?.ssiEMA != null ? currentSSI.ssiEMA.toFixed(2) : 'N/A'}
              </p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">5-dagers endring</h3>
            {loading && !currentSSI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className={`text-3xl font-bold ${fiveDayChange != null && fiveDayChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {fiveDayChange != null ? `${fiveDayChange >= 0 ? '+' : ''}${fiveDayChange.toFixed(2)}` : 'N/A'}
              </p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Kumulativ SSI</h3>
            {loading && !currentSSI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">
                {currentSSI?.ssiCumulative != null ? currentSSI.ssiCumulative.toFixed(2) : 'N/A'}
              </p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Sentiment</h3>
            {loading && !currentSSI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className={`text-xl font-bold ${getSentimentColor(sentiment)}`}>{sentiment}</p>
            )}
          </Card>
        </div>

        {/* SSI EMA Chart */}
        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5 mb-8">
          <h2 className="text-2xl font-bold mb-4">SSI (10-dagers EMA) over tid</h2>
          {loading && ssiData.length === 0 ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={emaChartData}>
                <defs>
                  <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  label={{ value: 'SSI (EMA)', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(3)}`, 'SSI (EMA)']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label="Nøytral" />
                {emaStats && (
                  <>
                    <ReferenceLine 
                      y={emaStats.upperBand} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="3 3" 
                      label="+1σ" 
                    />
                    <ReferenceLine 
                      y={emaStats.lowerBand} 
                      stroke="hsl(var(--chart-2))" 
                      strokeDasharray="3 3" 
                      label="-1σ" 
                    />
                  </>
                )}
                <Area 
                  type="monotone" 
                  dataKey="positive" 
                  stroke="none"
                  fill="url(#colorPositive)"
                  stackId="1"
                />
                <Area 
                  type="monotone" 
                  dataKey="negative" 
                  stroke="none"
                  fill="url(#colorNegative)"
                  stackId="1"
                />
                <Line 
                  type="monotone" 
                  dataKey="ssiEMA" 
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* SSI Cumulative Chart */}
        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5 mb-8">
          <h2 className="text-2xl font-bold mb-4">Kumulativ SSI over tid</h2>
          {loading && ssiData.length === 0 ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={cumChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  label={{ value: 'Kumulativ SSI', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)}`, 'Kumulativ SSI']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label="Null" />
                {cumStats && (
                  <>
                    <ReferenceLine 
                      y={cumStats.upperBand} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="3 3" 
                      label="+1σ" 
                    />
                    <ReferenceLine 
                      y={cumStats.lowerBand} 
                      stroke="hsl(var(--chart-2))" 
                      strokeDasharray="3 3" 
                      label="-1σ" 
                    />
                    <ReferenceLine 
                      y={cumStats.p90} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="5 5" 
                      strokeOpacity={0.5}
                      label="P90" 
                    />
                    <ReferenceLine 
                      y={cumStats.p10} 
                      stroke="hsl(var(--chart-2))" 
                      strokeDasharray="5 5" 
                      strokeOpacity={0.5}
                      label="P10" 
                    />
                  </>
                )}
                <Line 
                  type="monotone" 
                  dataKey="ssiCumulative" 
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Component Heatmap */}
        <Card className="p-6 shadow-lg border-2 mb-8">
          <h2 className="text-2xl font-bold mb-4">Komponentanalyse (siste 10 dager)</h2>
          {loading && ssiData.length === 0 ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border p-2 text-left bg-muted">Dato</th>
                    <th className="border border-border p-2 text-center bg-muted">CSD</th>
                    <th className="border border-border p-2 text-center bg-muted">Rotasjon</th>
                    <th className="border border-border p-2 text-center bg-muted">VDI</th>
                    <th className="border border-border p-2 text-center bg-muted">LARS</th>
                    <th className="border border-border p-2 text-center bg-muted">SMFI</th>
                    <th className="border border-border p-2 text-center bg-muted">Relativ Ytelse</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-border p-2 text-sm">{row.date}</td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row.CSD) }}
                        title={`Z-score: ${row.CSD.toFixed(3)}`}
                      >
                        {row.CSD.toFixed(2)}
                      </td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row.Rotasjon) }}
                        title={`Z-score: ${row.Rotasjon.toFixed(3)}`}
                      >
                        {row.Rotasjon.toFixed(2)}
                      </td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row.VDI) }}
                        title={`Z-score: ${row.VDI.toFixed(3)}`}
                      >
                        {row.VDI.toFixed(2)}
                      </td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row.LARS) }}
                        title={`Z-score: ${row.LARS.toFixed(3)}`}
                      >
                        {row.LARS.toFixed(2)}
                      </td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row.SMFI) }}
                        title={`Z-score: ${row.SMFI.toFixed(3)}`}
                      >
                        {row.SMFI.toFixed(2)}
                      </td>
                      <td 
                        className="border border-border p-2 text-center font-mono text-sm"
                        style={{ backgroundColor: getHeatColor(row['Relativ Ytelse']) }}
                        title={`Z-score: ${row['Relativ Ytelse'].toFixed(3)}`}
                      >
                        {row['Relativ Ytelse'].toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-accent/10">
          <h3 className="text-lg font-semibold mb-2">Om SSI</h3>
          <p className="text-muted-foreground mb-2">
            SSI (Sector Sentiment Index) er en omfattende sentiment-indikator som kombinerer seks proprietære metrikker:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><strong>CSD</strong> (Cross-Sectional Dispersion)</li>
            <li><strong>Kapitalrotasjon</strong></li>
            <li><strong>VDI</strong> (Volatility Divergence Index)</li>
            <li><strong>LARS</strong> (Liquidity-Adjusted Return Skew)</li>
            <li><strong>SMFI</strong> (Smart Money Flow Index)</li>
            <li><strong>Relativ Ytelse</strong></li>
          </ul>
          <p className="text-muted-foreground mb-2">
            <strong>SSI_EMA</strong> måler kortsiktig sentiment i banksektoren gjennom en 10-dagers eksponensiell glidende gjennomsnitt.
          </p>
          <p className="text-muted-foreground">
            <strong>SSI_CUM</strong> viser langsiktig regime-bias. Stigende verdier indikerer defensiv posisjonering, 
            mens fallende verdier signaliserer økende risikoappetitt.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default SectorSentimentIndex;
