import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

const Backtesting = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  // Configuration
  const [signalName, setSignalName] = useState('abnormal_volume');
  const [threshold, setThreshold] = useState(2.0);
  const [startDate, setStartDate] = useState('2024-05-01');
  const [endDate, setEndDate] = useState('2024-11-14');
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [maxPositions, setMaxPositions] = useState(5);
  const [holdingPeriod, setHoldingPeriod] = useState(5);
  const [positionSizing, setPositionSizing] = useState<'equal' | 'signal' | 'volatility'>('equal');

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
          positionSizing,
        },
      });

      if (error) throw error;
      setResults(data);
      toast({
        title: 'Backtest Complete',
        description: `Total return: ${data.stats.totalReturn.toFixed(2)}%`,
      });
    } catch (error: any) {
      console.error('Backtest error:', error);
      toast({
        title: 'Backtest Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Backtesting</h1>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Configuration</CardTitle>
          <CardDescription>Configure portfolio simulation parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Signal</Label>
              <Select value={signalName} onValueChange={setSignalName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abnormal_volume">Abnormal Volume</SelectItem>
                  <SelectItem value="alpha_engine">Alpha Engine</SelectItem>
                  <SelectItem value="dispersion_signals">Dispersion</SelectItem>
                  <SelectItem value="lars_signals">LARS</SelectItem>
                  <SelectItem value="smfi_signals">SMFI</SelectItem>
                  <SelectItem value="ssi_signals">SSI</SelectItem>
                  <SelectItem value="vdi_signals">VDI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Position Sizing</Label>
              <Select value={positionSizing} onValueChange={(v: any) => setPositionSizing(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal Weight</SelectItem>
                  <SelectItem value="signal">Signal-Weighted</SelectItem>
                  <SelectItem value="volatility">Volatility-Adjusted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Initial Capital: {(initialCapital / 1000000).toFixed(1)}M NOK</Label>
              <Slider
                value={[initialCapital]}
                onValueChange={([value]) => setInitialCapital(value)}
                min={500000}
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
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Holding Period: {holdingPeriod} days</Label>
              <Slider
                value={[holdingPeriod]}
                onValueChange={([value]) => setHoldingPeriod(value)}
                min={1}
                max={60}
                step={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Threshold: {threshold.toFixed(1)}</Label>
              <Slider
                value={[threshold]}
                onValueChange={([value]) => setThreshold(value)}
                min={0.5}
                max={5}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <Button onClick={runBacktest} disabled={loading} className="w-full">
            {loading ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <>
          {/* Portfolio Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Final Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.stats.finalValue.toLocaleString()} NOK</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${results.stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.stats.totalReturn >= 0 ? '+' : ''}{results.stats.totalReturn.toFixed(2)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.stats.sharpeRatio.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">-{results.stats.maxDrawdown.toFixed(2)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Annualized</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.stats.annualizedReturn.toFixed(2)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Trade Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{results.tradeMetrics.profitFactor.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Win Rate: {results.tradeMetrics.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Best Trade</CardTitle>
              </CardHeader>
              <CardContent>
                {results.tradeMetrics.bestTrade && (
                  <>
                    <div className="text-2xl font-bold text-green-600">
                      +{results.tradeMetrics.bestTrade.pnl.toLocaleString()} NOK
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {results.tradeMetrics.bestTrade.ticker} (+{results.tradeMetrics.bestTrade.return.toFixed(1)}%)
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Worst Trade</CardTitle>
              </CardHeader>
              <CardContent>
                {results.tradeMetrics.worstTrade && (
                  <>
                    <div className="text-2xl font-bold text-red-600">
                      {results.tradeMetrics.worstTrade.pnl.toLocaleString()} NOK
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {results.tradeMetrics.worstTrade.ticker} ({results.tradeMetrics.worstTrade.return.toFixed(1)}%)
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Trade Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.tradeMetrics.avgTradeSize.toLocaleString()} NOK</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {results.tradeMetrics.totalTrades} trades
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Value & Active Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={results.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="portfolioValue" stroke="#8884d8" name="Portfolio Value (NOK)" />
                  <Line yAxisId="right" type="monotone" dataKey="numPositions" stroke="#82ca9d" name="Active Positions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trade Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Trade Timeline</CardTitle>
              <CardDescription>Buy and sell transactions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis dataKey="price" label={{ value: 'Price (NOK)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Scatter 
                    name="BUY" 
                    data={results.trades.filter((t: any) => t.type === 'BUY')} 
                    fill="#10b981"
                  />
                  <Scatter 
                    name="SELL" 
                    data={results.trades.filter((t: any) => t.type === 'SELL')} 
                    fill="#ef4444"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trades Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trade Log</CardTitle>
              <CardDescription>{results.trades.length} transactions executed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead>Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.trades.map((trade: any) => (
                      <TableRow key={trade.tradeId}>
                        <TableCell>{trade.tradeId}</TableCell>
                        <TableCell>
                          <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'}>
                            {trade.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{trade.ticker}</TableCell>
                        <TableCell>{trade.date}</TableCell>
                        <TableCell>{trade.price.toFixed(2)}</TableCell>
                        <TableCell>{trade.shares.toLocaleString()}</TableCell>
                        <TableCell>{trade.value.toLocaleString()}</TableCell>
                        <TableCell className={trade.pnl > 0 ? 'text-green-600' : trade.pnl < 0 ? 'text-red-600' : ''}>
                          {trade.pnl ? `${trade.pnl > 0 ? '+' : ''}${trade.pnl.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className={trade.return > 0 ? 'text-green-600' : trade.return < 0 ? 'text-red-600' : ''}>
                          {trade.return ? `${trade.return > 0 ? '+' : ''}${trade.return.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell>{trade.holdingDays || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Active Positions */}
          {results.activePositions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Positions (End of Period)</CardTitle>
                <CardDescription>{results.activePositions.length} positions still held</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Entry Date</TableHead>
                      <TableHead>Entry Price</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Entry Value</TableHead>
                      <TableHead>Signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.activePositions.map((pos: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{pos.ticker}</TableCell>
                        <TableCell>{pos.entryDate}</TableCell>
                        <TableCell>{pos.entryPrice.toFixed(2)}</TableCell>
                        <TableCell>{pos.shares.toLocaleString()}</TableCell>
                        <TableCell>{pos.entryValue.toLocaleString()}</TableCell>
                        <TableCell>{pos.signalValue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Backtesting;
