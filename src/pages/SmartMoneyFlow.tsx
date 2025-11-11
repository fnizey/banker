import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SMFIData {
  date: string;
  smfi: number;
  cumulativeSMFI: number;
  rotationZScore: number;
  vdiZScore: number;
  larsZScore: number;
}

interface SMFIResponse {
  smfiTimeSeries: SMFIData[];
  currentSMFI: SMFIData | null;
  sevenDayChange: number;
  sentiment: string;
  statistics: {
    mean: number;
    stdDev: number;
    upperBand: number;
    lowerBand: number;
  };
}

const SmartMoneyFlow = () => {
  const [smfiData, setSmfiData] = useState<SMFIData[]>([]);
  const [currentSMFI, setCurrentSMFI] = useState<SMFIData | null>(null);
  const [sevenDayChange, setSevenDayChange] = useState<number>(0);
  const [sentiment, setSentiment] = useState<string>('');
  const [statistics, setStatistics] = useState<SMFIResponse['statistics'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<30 | 90 | 180 | 365>(90);
  const [isCumulative, setIsCumulative] = useState(true);
  const { toast } = useToast();

  const fetchSMFIData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-smfi', {
        body: { days: selectedDays },
      });

      if (error) throw error;

      setSmfiData(data.smfiTimeSeries);
      setCurrentSMFI(data.currentSMFI);
      setSevenDayChange(data.sevenDayChange);
      setSentiment(data.sentiment);
      setStatistics(data.statistics);
    } catch (error) {
      console.error('Error fetching SMFI:', error);
      toast({
        title: 'Feil ved henting av SMFI',
        description: 'Kunne ikke hente data. Prøv igjen senere.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSMFIData();
  }, [selectedDays]);

  const getSentimentColor = (sentiment: string) => {
    if (sentiment.includes('Risk-off') || sentiment.includes('Defensiv')) return 'text-red-500';
    if (sentiment.includes('Risk-on') || sentiment.includes('Offensiv')) return 'text-green-500';
    return 'text-blue-500';
  };

  const chartData = smfiData.map(d => ({
    date: d.date,
    value: isCumulative ? d.cumulativeSMFI : d.smfi,
    rotationZScore: d.rotationZScore,
    vdiZScore: d.vdiZScore,
    larsZScore: d.larsZScore,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Smart Money Flow Index (SMFI)</h1>
            <p className="text-muted-foreground">
              Sammensatt sentiment-indikator for sektorkapitalflyt
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

        {/* Current SMFI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Nåværende SMFI</h3>
            {loading && !currentSMFI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-3xl font-bold">{currentSMFI?.smfi.toFixed(3) || 'N/A'}</p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">7-dagers endring</h3>
            {loading && !currentSMFI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className={`text-3xl font-bold ${sevenDayChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {sevenDayChange >= 0 ? '+' : ''}{sevenDayChange.toFixed(3)}
              </p>
            )}
          </Card>
          <Card className="p-6 shadow-lg border-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Sentiment</h3>
            {loading && !currentSMFI ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className={`text-xl font-bold ${getSentimentColor(sentiment)}`}>{sentiment}</p>
            )}
          </Card>
        </div>

        {/* Interpretation Card */}
        <Card className="p-6 mb-8 bg-muted/50">
          <h3 className="text-lg font-semibold mb-2">Tolkning</h3>
          <p className="text-muted-foreground">
            {currentSMFI && statistics ? (
              <>
                SMFI er {currentSMFI.smfi > statistics.upperBand ? 'over' : currentSMFI.smfi < statistics.lowerBand ? 'under' : 'innenfor'} normalområdet.
                {' '}
                {currentSMFI.smfi > 0 
                  ? 'Positive verdier indikerer risk-off dominans med kapitalflyt mot store banker.'
                  : 'Negative verdier indikerer stealth risk-on sentiment med kapitalflyt mot mindre banker.'}
              </>
            ) : (
              'Ingen data tilgjengelig'
            )}
          </p>
        </Card>

        {/* SMFI Time Series Chart */}
        <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h2 className="text-2xl font-bold">
              {isCumulative ? 'Kumulativ SMFI' : 'SMFI'} over tid ({selectedDays} dager)
            </h2>
            <div className="flex gap-2">
              <Button 
                variant={!isCumulative ? "default" : "outline"}
                onClick={() => setIsCumulative(false)}
                size="sm"
              >
                Vanlig
              </Button>
              <Button 
                variant={isCumulative ? "default" : "outline"}
                onClick={() => setIsCumulative(true)}
                size="sm"
              >
                Kumulativ
              </Button>
            </div>
          </div>
          {loading && smfiData.length === 0 ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  label={{ value: isCumulative ? 'Kumulativ SMFI' : 'SMFI', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(3)}`, isCumulative ? 'Kumulativ SMFI' : 'SMFI']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label="Nøytral" />
                {!isCumulative && statistics && (
                  <>
                    <ReferenceLine 
                      y={statistics.upperBand} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="3 3" 
                      label="+1σ (Risk-off)" 
                    />
                    <ReferenceLine 
                      y={statistics.lowerBand} 
                      stroke="hsl(var(--chart-2))" 
                      strokeDasharray="3 3" 
                      label="-1σ (Risk-on)" 
                    />
                  </>
                )}
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name={isCumulative ? 'Kumulativ SMFI' : 'SMFI'}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Component Z-Scores */}
        <Card className="p-6 shadow-lg border-2 mb-8">
          <h2 className="text-2xl font-bold mb-4">Komponentanalyse (Z-scores)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Rotasjon Z-Score</h4>
              <p className="text-2xl font-bold">{currentSMFI?.rotationZScore.toFixed(3) || 'N/A'}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">VDI Z-Score</h4>
              <p className="text-2xl font-bold">{currentSMFI?.vdiZScore.toFixed(3) || 'N/A'}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">LARS Z-Score</h4>
              <p className="text-2xl font-bold">{currentSMFI?.larsZScore.toFixed(3) || 'N/A'}</p>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-accent/10">
          <h3 className="text-lg font-semibold mb-2">Om SMFI</h3>
          <p className="text-muted-foreground mb-4">
            SMFI er en sammensatt sentiment-indikator som kombinerer tre proprietære metrikker:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>VDI</strong> oppdager divergens mellom volatilitet og likviditet</li>
            <li><strong>LARS</strong> måler asymmetrisk avkastning justert for likviditet</li>
            <li><strong>SMFI</strong> kombinerer begge med kumulativ rotasjon for å fange smart-money sentiment i sektoren</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Formelen: SMFI = z(KumulativRotasjon) + z(VDI) - z(LARS)
          </p>
        </Card>
      </div>
    </div>
  );
};

export default SmartMoneyFlow;
