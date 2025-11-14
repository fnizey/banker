import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BacktestStats {
  sharpe: number;
  avgReturn1d: number;
  avgReturn5d: number;
  avgReturn20d: number;
  winRate1d: number;
  winRate5d: number;
  winRate20d: number;
  maxDrawdown: number;
  numTrades: number;
  avgSignalValue: number;
  medianSignalValue: number;
}

interface BacktestResult {
  signalName: string;
  threshold: number;
  stats: BacktestStats;
  forwardReturns: {
    date: string;
    ticker: string;
    signalValue: number;
    return1d: number;
    return5d: number;
    return20d: number;
  }[];
  equityCurve: {
    date: string;
    cumulativeReturn: number;
  }[];
}

const SIGNAL_OPTIONS = [
  { value: 'abnormalVolume', label: 'Abnormal Volume (Z-Score)', defaultThreshold: 2.0 },
  { value: 'lars', label: 'LARS (Turnover Percentile)', defaultThreshold: 75 },
  { value: 'volumeAnomaly', label: 'Volume Spike (%)', defaultThreshold: 50 },
];

const THRESHOLD_PRESETS: Record<string, number[]> = {
  abnormalVolume: [1.0, 1.5, 2.0, 2.5, 3.0],
  lars: [60, 70, 75, 80, 90],
  volumeAnomaly: [30, 50, 75, 100, 150],
};

export default function Backtesting() {
  const [selectedSignal, setSelectedSignal] = useState('abnormalVolume');
  const [threshold, setThreshold] = useState<number>(2.0);
  const [days, setDays] = useState(180);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backtest', selectedSignal, threshold, days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-backtest', {
        body: { signalType: selectedSignal, threshold, days }
      });
      if (error) throw error;
      return data as BacktestResult;
    },
    enabled: false // Manual trigger
  });

  const handleRunBacktest = () => {
    refetch();
  };

  const handleSignalChange = (value: string) => {
    setSelectedSignal(value);
    const signal = SIGNAL_OPTIONS.find(s => s.value === value);
    if (signal) {
      setThreshold(signal.defaultThreshold);
    }
  };

  const getSharpeColor = (sharpe: number) => {
    if (sharpe >= 1.5) return 'text-green-600';
    if (sharpe >= 1.0) return 'text-emerald-600';
    if (sharpe >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'text-green-600';
    if (winRate >= 55) return 'text-emerald-600';
    if (winRate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Signal Backtesting</h1>
        <p className="text-muted-foreground">
          Valider historisk performance for trading signals med forward returns, Sharpe ratios, og risk metrics
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Configuration</CardTitle>
          <CardDescription>
            Velg signal type, threshold, og historisk periode for backtesting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Signal Type</label>
              <Select value={selectedSignal} onValueChange={handleSignalChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNAL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Threshold</label>
              <Select value={threshold.toString()} onValueChange={(v) => setThreshold(parseFloat(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_PRESETS[selectedSignal]?.map(t => (
                    <SelectItem key={t} value={t.toString()}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Historical Days</label>
              <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90 dager</SelectItem>
                  <SelectItem value="180">180 dager</SelectItem>
                  <SelectItem value="365">1 år</SelectItem>
                  <SelectItem value="730">2 år</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleRunBacktest} className="w-full" disabled={isLoading}>
            {isLoading ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to run backtest'}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getSharpeColor(data.stats.sharpe)}`}>
                  {data.stats.sharpe.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.stats.sharpe >= 1.0 ? 'Strong signal' : data.stats.sharpe >= 0.5 ? 'Moderate' : 'Weak'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg 5d Return</CardTitle>
                {data.stats.avgReturn5d > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.stats.avgReturn5d > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.stats.avgReturn5d > 0 ? '+' : ''}{data.stats.avgReturn5d.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  1d: {data.stats.avgReturn1d.toFixed(2)}% | 20d: {data.stats.avgReturn20d.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Win Rate (5d)</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getWinRateColor(data.stats.winRate5d)}`}>
                  {data.stats.winRate5d.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  1d: {data.stats.winRate1d.toFixed(1)}% | 20d: {data.stats.winRate20d.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  -{data.stats.maxDrawdown.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.stats.numTrades} trades total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Return (5-day holding)</CardTitle>
              <CardDescription>
                Total cumulative return hvis du handlet alle signal triggers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Return (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeReturn" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    name="Cumulative Return (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Forward Returns Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Signal Value vs 5-Day Forward Returns</CardTitle>
              <CardDescription>
                Scatter plot som viser forholdet mellom signal strength og returns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="signalValue" 
                    name="Signal Value"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    dataKey="return5d" 
                    name="5d Return (%)"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    cursor={{ strokeDasharray: '3 3' }}
                  />
                  <Scatter 
                    data={data.forwardReturns} 
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Interpretation Guide */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hvordan tolke resultatene</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p><strong>Sharpe Ratio:</strong> {'>'} 1.5 = Excellent | 1.0-1.5 = Good | 0.5-1.0 = Moderate | {'<'} 0.5 = Weak</p>
              <p><strong>Win Rate:</strong> {'>'} 60% = Strong predictive power | 55-60% = Good | 50-55% = Marginal | {'<'} 50% = No edge</p>
              <p><strong>Max Drawdown:</strong> Verste tap-periode. {'<'} 15% = Excellent | 15-25% = Acceptable | {'>'} 25% = High risk</p>
              <p><strong>Realistic Edge:</strong> Med Yahoo Finance data er Sharpe 1.0-1.5 realistisk. Higher Sharpe kan indikere overfitting.</p>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
