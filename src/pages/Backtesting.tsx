import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SIGNAL_INFO: Record<string, { name: string; description: string; thresholdGuide: string }> = {
  'abnormal_volume': {
    name: 'Abnormal Volume',
    description: 'Identifies banks with unusual trading activity',
    thresholdGuide: 'Z-score threshold (2.0 = 2 std deviations, typically significant)'
  },
  'lars': {
    name: 'Liquidity-Adjusted Return Skew (LARS)',
    description: 'Sector-wide signal based on return distribution skewness',
    thresholdGuide: 'LARS threshold (0.5 = moderate skew, triggers all banks)'
  },
  'alpha_engine': {
    name: 'Alpha Engine',
    description: 'Multi-factor alpha score for individual banks',
    thresholdGuide: 'BAS_EMA threshold (2.0 = strong alpha signal)'
  },
  'vdi': {
    name: 'Volatility Divergence Index (VDI)',
    description: 'Measures divergence in volatility patterns',
    thresholdGuide: 'VDI threshold (1.0 = high volatility divergence)'
  },
  'ssi': {
    name: 'Sector Sentiment Index (SSI)',
    description: 'Composite sentiment indicator for banking sector',
    thresholdGuide: 'SSI threshold (1.0 = positive sector sentiment)'
  },
  'rotation': {
    name: 'Capital Rotation',
    description: 'Identifies rotation between small/mid/large cap banks',
    thresholdGuide: 'Rotation strength threshold (1.0 = clear rotation signal)'
  },
  'smfi': {
    name: 'Smart Money Flow Index (SMFI)',
    description: 'Tracks institutional money flow patterns',
    thresholdGuide: 'SMFI threshold (1.0 = significant smart money inflow)'
  }
};

const Backtesting = () => {
  const [signalName, setSignalName] = useState('abnormal_volume');
  const [threshold, setThreshold] = useState(2);
  const [startDate, setStartDate] = useState('2024-05-01');
  const [endDate, setEndDate] = useState('2024-11-14');
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [maxPositions, setMaxPositions] = useState(5);
  const [holdingPeriod, setHoldingPeriod] = useState(5);
  const [positionSizing, setPositionSizing] = useState('equal');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [checkingData, setCheckingData] = useState(true);

  useEffect(() => {
    checkDataAvailability();
  }, []);

  const checkDataAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('signal_history')
        .select('date, signal_type')
        .order('date', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      // Check if we have data in the requested date range
      const { count: rangeCount } = await supabase
        .from('signal_history')
        .select('*', { count: 'exact', head: true })
        .gte('date', startDate)
        .lte('date', endDate);
      
      console.log(`Found ${rangeCount} records in date range ${startDate} to ${endDate}`);
      console.log('Latest record:', data?.[0]);
      
      setNeedsInitialization(!rangeCount || rangeCount === 0);
    } catch (error) {
      console.error('Error checking data:', error);
      setNeedsInitialization(true);
    } finally {
      setCheckingData(false);
    }
  };

  const initializeHistoricalData = async () => {
    setInitializing(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log('Starting historical data initialization...');
      
      const { data, error } = await supabase.functions.invoke('backfill-signal-history', {
        body: {
          startDate,
          endDate,
          days: 180
        }
      });

      if (error) {
        console.error('Backfill error:', error);
        throw error;
      }
      
      console.log('Backfill response:', data);
      
      // Verify data was actually inserted
      const { count } = await supabase
        .from('signal_history')
        .select('*', { count: 'exact', head: true });
      
      console.log('Records in database after initialization:', count);
      
      if (count === 0) {
        throw new Error('No data was inserted. Please check the edge function logs.');
      }
      
      toast({
        title: "Data Initialized Successfully!",
        description: `Loaded ${data.totalSignals} signals across ${Object.keys(data.breakdown).length} signal types. ${count} records in database.`
      });
      
      setNeedsInitialization(false);
    } catch (error) {
      console.error('Initialization error:', error);
      toast({
        title: "Initialization Failed",
        description: error instanceof Error ? error.message : 'Failed to initialize historical data. Check console for details.',
        variant: "destructive"
      });
    } finally {
      setInitializing(false);
    }
  };

  const runBacktest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-backtest', {
        body: {
          signalName,
          threshold,
          startDate,
          endDate,
          initialCapital,
          maxPositions,
          holdingPeriod,
          positionSizing
        }
      });

      if (error) throw error;
      
      setResults(data);
      toast({
        title: "Backtest Complete",
        description: `Final Value: ${data.stats.finalValue.toLocaleString('no-NO')} NOK (${data.stats.totalReturn.toFixed(2)}% return)`
      });
    } catch (error) {
      console.error('Backtest error:', error);
      toast({
        title: "Backtest Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const currentSignalInfo = SIGNAL_INFO[signalName];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {needsInitialization && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Database className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-lg font-semibold">⚠️ No Data for Selected Date Range</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-base">No historical signals found for {startDate} to {endDate}.</p>
            <p className="text-sm text-muted-foreground">
              <strong>Important:</strong> The backfill function can only populate data from May 2025 onwards (when signals started). 
              Please adjust your backtest dates to a more recent period.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={initializeHistoricalData} 
                disabled={initializing}
                size="lg"
                variant="default"
              >
                {initializing ? "⏳ Initializing..." : "🚀 Load Recent Data (180 days)"}
              </Button>
              <Button 
                onClick={() => {
                  const recentEnd = new Date().toISOString().split('T')[0];
                  const recentStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setStartDate(recentStart);
                  setEndDate(recentEnd);
                  checkDataAvailability();
                }}
                size="lg"
                variant="outline"
              >
                Use Recent Dates
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Backtesting Framework</h1>
        <p className="text-muted-foreground">
          Test trading strategies across multiple signal types with realistic portfolio simulation
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <h2 className="text-xl font-semibold">Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Signal Type</Label>
            <Select value={signalName} onValueChange={setSignalName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIGNAL_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{currentSignalInfo.description}</p>
          </div>

          <div className="space-y-2">
            <Label>Position Sizing Strategy</Label>
            <Select value={positionSizing} onValueChange={setPositionSizing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal Weight</SelectItem>
                <SelectItem value="risk_parity">Risk Parity</SelectItem>
                <SelectItem value="signal_weighted">Signal Weighted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Signal Threshold: {threshold.toFixed(1)}</Label>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => setThreshold(value)}
              min={0}
              max={5}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">{currentSignalInfo.thresholdGuide}</p>
          </div>

          <div className="space-y-2">
            <Label>Initial Capital (NOK): {initialCapital.toLocaleString('no-NO')}</Label>
            <Slider
              value={[initialCapital]}
              onValueChange={([value]) => setInitialCapital(value)}
              min={100000}
              max={10000000}
              step={100000}
            />
          </div>

          <div className="space-y-2">
            <Label>Max Positions: {maxPositions}</Label>
            <Slider
              value={[maxPositions]}
              onValueChange={([value]) => setMaxPositions(value)}
              min={1}
              max={15}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Holding Period (Days): {holdingPeriod}</Label>
            <Slider
              value={[holdingPeriod]}
              onValueChange={([value]) => setHoldingPeriod(value)}
              min={1}
              max={30}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button 
          onClick={runBacktest} 
          disabled={loading || needsInitialization || checkingData}
          className="w-full"
          size="lg"
        >
          {loading ? 'Running Backtest...' : checkingData ? 'Checking data...' : 'Run Backtest'}
        </Button>
      </Card>

      {results && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Initial Capital</div>
              <div className="text-2xl font-bold">
                {results.stats.initialCapital.toLocaleString('no-NO')} NOK
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Final Value</div>
              <div className="text-2xl font-bold">
                {results.stats.finalValue.toLocaleString('no-NO')} NOK
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Return</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${results.stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {results.stats.totalReturn >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {results.stats.totalReturn.toFixed(2)}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Annualized Return</div>
              <div className="text-2xl font-bold">
                {results.stats.annualizedReturn.toFixed(2)}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
              <div className="text-2xl font-bold">
                {results.stats.sharpeRatio.toFixed(2)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-600">
                -{results.stats.maxDrawdown.toFixed(2)}%
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-bold">{results.tradeMetrics.totalTrades}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold">{results.tradeMetrics.winRate.toFixed(1)}%</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Profit Factor</div>
              <div className="text-2xl font-bold">{results.tradeMetrics.profitFactor.toFixed(2)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Avg Trade Size</div>
              <div className="text-2xl font-bold">{results.tradeMetrics.avgTradeSize.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Best Trade</div>
              <div className="text-2xl font-bold text-green-600">+{results.tradeMetrics.bestTrade.toFixed(2)}%</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Worst Trade</div>
              <div className="text-2xl font-bold text-red-600">{results.tradeMetrics.worstTrade.toFixed(2)}%</div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Equity Curve & Active Positions</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={results.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="portfolioValue" stroke="#8884d8" name="Portfolio Value" />
                <Line yAxisId="right" type="monotone" dataKey="numPositions" stroke="#82ca9d" name="Active Positions" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Trade Timeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis dataKey="price" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter 
                  name="BUY" 
                  data={results.trades.filter((t: any) => t.type === 'BUY')} 
                  fill="#22c55e" 
                />
                <Scatter 
                  name="SELL" 
                  data={results.trades.filter((t: any) => t.type === 'SELL')} 
                  fill="#ef4444" 
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Trade History</h3>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.trades.map((trade: any) => (
                    <TableRow key={trade.tradeId}>
                      <TableCell>
                        <span className={trade.type === 'BUY' ? 'text-green-600' : 'text-red-600'}>
                          {trade.type}
                        </span>
                      </TableCell>
                      <TableCell>{trade.date}</TableCell>
                      <TableCell className="font-mono">{trade.ticker}</TableCell>
                      <TableCell>{trade.price.toFixed(2)}</TableCell>
                      <TableCell>{trade.shares}</TableCell>
                      <TableCell>{trade.value.toLocaleString('no-NO', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>{trade.signalValue.toFixed(2)}</TableCell>
                      <TableCell>
                        {trade.pnl !== undefined ? (
                          <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString('no-NO', { maximumFractionDigits: 0 })}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {trade.return !== undefined ? (
                          <span className={trade.return >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {trade.return >= 0 ? '+' : ''}{trade.return.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {results.activePositions && results.activePositions.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Active Positions (End of Period)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Entry Date</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Entry Value</TableHead>
                    <TableHead>Signal Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.activePositions.map((pos: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{pos.ticker}</TableCell>
                      <TableCell>{pos.entryDate}</TableCell>
                      <TableCell>{pos.entryPrice.toFixed(2)}</TableCell>
                      <TableCell>{pos.shares}</TableCell>
                      <TableCell>{pos.entryValue.toLocaleString('no-NO', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>{pos.signalValue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Backtesting;
