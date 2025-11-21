import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AdvancedAnalytics = () => {
  const [activeTab, setActiveTab] = useState('alpha-engine');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Fetch Alpha Engine data
  const { data: alphaData, isLoading: alphaLoading } = useQuery({
    queryKey: ['alpha-engine'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-alpha-engine', {
        body: { days: 365 }
      });
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch Outlier Radar data
  const { data: outlierData, isLoading: outlierLoading } = useQuery({
    queryKey: ['outlier-radar'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-outlier-radar', {
        body: { days: 90 }
      });
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch Regime & Correlation data
  const { data: regimeData, isLoading: regimeLoading } = useQuery({
    queryKey: ['regime-correlation'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-regime-correlation', {
        body: { days: 180 }
      });
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const getHeatColor = (value: number) => {
    const intensity = Math.min(Math.abs(value), 2) / 2;
    if (value > 0) return `rgba(34, 197, 94, ${intensity})`;
    return `rgba(239, 68, 68, ${intensity})`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <h1 className="text-4xl font-bold mb-2">Avansert Analyse</h1>
        <p className="text-muted-foreground mb-6">
          Dynamisk alpha-scoring, outlier-deteksjon og regime-analyse
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="alpha-engine">Alpha Engine</TabsTrigger>
            <TabsTrigger value="outlier-radar">Outlier Radar</TabsTrigger>
            <TabsTrigger value="regime-correlation">Regime & Correlation</TabsTrigger>
          </TabsList>

          {/* TAB 1: ALPHA ENGINE */}
          <TabsContent value="alpha-engine" className="space-y-6">
            {alphaLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : alphaData ? (
              <>
                {/* Info box */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      <strong>BAS (Bank Alpha Score)</strong> kombinerer residual momentum (+), liquidity asymmetry (−), 
                      size rotation context og volatility spread for å rangere vedvarende vinnere og tapere.
                    </p>
                  </CardContent>
                </Card>

                {/* Top cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Top Alpha</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{alphaData.topAlpha?.name || 'N/A'}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        BAS: {alphaData.topAlpha?.basEMA?.toFixed(3) || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <Badge variant="outline" className="text-green-600">Høy momentum</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Bottom Alpha</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{alphaData.bottomAlpha?.name || 'N/A'}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        BAS: {alphaData.bottomAlpha?.basEMA?.toFixed(3) || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <Badge variant="outline" className="text-red-600">Lav momentum</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Sector SRF</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{alphaData.sectorSRF?.toFixed(3) || 'N/A'}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alphaData.sectorSRF > 0 ? 'Risk-on (Small outperformer)' : 'Risk-off (Large outperformer)'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <Badge variant="outline">{alphaData.sectorSRF > 0 ? 'Risk-on' : 'Risk-off'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle>Leaderboard</CardTitle>
                    <CardDescription>Top 5 / Bottom 5 BAS med 20-dagers sparkline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-green-600">Top 5</h3>
                        <div className="space-y-2">
                          {alphaData.top5?.map((bank: any, i: number) => (
                            <div key={bank.ticker} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedBank(bank.ticker)}>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-muted-foreground">#{i + 1}</span>
                                <div>
                                  <div className="font-medium">{bank.name}</div>
                                  <div className="text-xs text-muted-foreground">BAS: {bank.basEMA?.toFixed(3)}</div>
                                </div>
                              </div>
                              <div className="w-24 h-12">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={bank.sparkline?.map((v: number, i: number) => ({ i, v })) || []}>
                                    <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-red-600">Bottom 5</h3>
                        <div className="space-y-2">
                          {alphaData.bottom5?.map((bank: any, i: number) => (
                            <div key={bank.ticker} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedBank(bank.ticker)}>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-muted-foreground">#{i + 1}</span>
                                <div>
                                  <div className="font-medium">{bank.name}</div>
                                  <div className="text-xs text-muted-foreground">BAS: {bank.basEMA?.toFixed(3)}</div>
                                </div>
                              </div>
                              <div className="w-24 h-12">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={bank.sparkline?.map((v: number, i: number) => ({ i, v })) || []}>
                                    <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Heatmap */}
                <Card>
                  <CardHeader>
                    <CardTitle>Factor Heatmap</CardTitle>
                    <CardDescription>Siste dag: zRMF, zLAF, SRF, VSF, BAS_EMA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Bank</th>
                            <th className="text-center p-2">zRMF</th>
                            <th className="text-center p-2">zLAF</th>
                            <th className="text-center p-2">SRF</th>
                            <th className="text-center p-2">VSF</th>
                            <th className="text-center p-2">BAS_EMA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alphaData.heatmapData?.map((bank: any) => (
                            <tr key={bank.ticker} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-medium">{bank.name}</td>
                              <td className="p-2 text-center" style={{ backgroundColor: getHeatColor(bank.zRMF) }}>
                                {bank.zRMF?.toFixed(2)}
                              </td>
                              <td className="p-2 text-center" style={{ backgroundColor: getHeatColor(-bank.zLAF) }}>
                                {bank.zLAF?.toFixed(2)}
                              </td>
                              <td className="p-2 text-center" style={{ backgroundColor: getHeatColor(bank.srf) }}>
                                {bank.srf?.toFixed(3)}
                              </td>
                              <td className="p-2 text-center" style={{ backgroundColor: getHeatColor(bank.vsf) }}>
                                {bank.vsf?.toFixed(3)}
                              </td>
                              <td className="p-2 text-center font-semibold" style={{ backgroundColor: getHeatColor(bank.basEMA) }}>
                                {bank.basEMA?.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center text-muted-foreground">Ingen data tilgjengelig</div>
            )}
          </TabsContent>

          {/* TAB 2: OUTLIER RADAR */}
          <TabsContent value="outlier-radar" className="space-y-6">
            {outlierLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : outlierData ? (
              <>
                {/* Info box */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Vi isolerer idiosyncratic moves via cross-sectional regression og fremhever persistence (API). 
                      Lav R² indikerer bedre stock-picking-miljø; høy R² indikerer makro-drevet marked.
                    </p>
                  </CardContent>
                </Card>

                {/* Alpha Environment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Alpha Environment</CardTitle>
                    <CardDescription>Rolling 20-dag R² av daglig regresjon</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold">{(outlierData.rSquared20d * 100).toFixed(1)}%</div>
                      <Badge variant={outlierData.alphaEnvironment === 'Favorable' ? 'default' : outlierData.alphaEnvironment === 'Difficult' ? 'destructive' : 'secondary'}>
                        {outlierData.alphaEnvironment}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {outlierData.alphaEnvironment === 'Favorable' ? 'Godt stock-picking miljø' : outlierData.alphaEnvironment === 'Difficult' ? 'Vanskelig stock-picking miljø' : 'Nøytralt miljø'}
                    </p>
                  </CardContent>
                </Card>

                {/* Outlier table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Positive Outliers</CardTitle>
                      <CardDescription>SRES høy med ATS ≥ 1</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {outlierData.positiveOutliers?.map((bank: any) => (
                          <div key={bank.ticker} className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                            <div className="font-medium">{bank.name}</div>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div>SRES: <span className="font-semibold">{bank.sres?.toFixed(3)}</span></div>
                              <div>ATS: <span className="font-semibold">{bank.ats?.toFixed(2)}</span></div>
                              <div>API (60d): <span className="font-semibold">{(bank.api * 100).toFixed(1)}%</span></div>
                              <div>Δ5d: <span className="font-semibold">{bank.deltaSRES5d?.toFixed(3) || 'N/A'}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Negative Outliers</CardTitle>
                      <CardDescription>SRES lav med ATS ≥ 1</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {outlierData.negativeOutliers?.map((bank: any) => (
                          <div key={bank.ticker} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                            <div className="font-medium">{bank.name}</div>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div>SRES: <span className="font-semibold">{bank.sres?.toFixed(3)}</span></div>
                              <div>ATS: <span className="font-semibold">{bank.ats?.toFixed(2)}</span></div>
                              <div>API (60d): <span className="font-semibold">{(bank.api * 100).toFixed(1)}%</span></div>
                              <div>Δ5d: <span className="font-semibold">{bank.deltaSRES5d?.toFixed(3) || 'N/A'}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Scatter plot */}
                <Card>
                  <CardHeader>
                    <CardTitle>Return vs TO_Norm (i dag)</CardTitle>
                    <CardDescription>Fargekode: grønn = positiv SRES, rød = negativ SRES</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number" 
                          dataKey="turnoverNorm" 
                          name="TO_Norm"
                          stroke="hsl(var(--foreground))"
                          label={{ 
                            value: 'Normalized Turnover', 
                            position: 'insideBottom', 
                            offset: -10,
                            style: { fill: 'hsl(var(--foreground))' }
                          }} 
                        />
                        <YAxis 
                          type="number" 
                          dataKey="return" 
                          name="Return"
                          stroke="hsl(var(--foreground))"
                          tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                          label={{ 
                            value: 'Return', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { fill: 'hsl(var(--foreground))' }
                          }} 
                        />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                          if (!payload || payload.length === 0) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
                              <div className="font-semibold mb-1">{data.name}</div>
                              <div>Return: {(data.return * 100).toFixed(2)}%</div>
                              <div>TO_Norm: {data.turnoverNorm?.toFixed(2)}</div>
                              <div>SRES: {data.sres?.toFixed(3)}</div>
                            </div>
                          );
                        }} />
                        <Scatter data={outlierData.scatterData} fill="hsl(var(--primary))">
                          {outlierData.scatterData?.map((entry: any, index: number) => {
                            const color = entry.sres > 0 ? '#22c55e' : entry.sres < 0 ? '#ef4444' : '#94a3b8';
                            return (
                              <circle
                                key={`cell-${index}`}
                                cx={0}
                                cy={0}
                                r={5}
                                fill={color}
                                fillOpacity={0.7}
                              />
                            );
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center text-muted-foreground">Ingen data tilgjengelig</div>
            )}
          </TabsContent>

          {/* TAB 3: REGIME & CORRELATION */}
          <TabsContent value="regime-correlation" className="space-y-6">
            {regimeLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : regimeData ? (
              <>
                {/* Info box */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Bruk regime og correlation concentration for å bestemme når du skal stole på aksje-spesifikk alpha. 
                      Høy CC indikerer crowding/systemic risk; lav CC indikerer idiosyncratic alpha regime.
                    </p>
                  </CardContent>
                </Card>

                {/* Metrics cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Regime</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{regimeData.currentRegime}</div>
                      <Badge variant={regimeData.currentRegime === 'Risk-on' ? 'default' : regimeData.currentRegime === 'Risk-off' ? 'destructive' : 'secondary'} className="mt-2">
                        {regimeData.currentRegime}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">CC (Correlation Concentration)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{regimeData.currentCC?.toFixed(3)}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {regimeData.currentCC > 0.5 ? 'Høy crowding' : 'Lav crowding'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">XCI (Cross-Sectional Correlation)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{regimeData.currentXCI?.toFixed(3)}</div>
                      <p className="text-xs text-muted-foreground mt-1">20-dagers gjennomsnitt</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">FBI (Liquidity Breadth)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{(regimeData.currentFBI * 100).toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        30d avg: {(regimeData.avgFBI30d * 100).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart 1: CC and XCI */}
                <Card>
                  <CardHeader>
                    <CardTitle>Correlation Metrics</CardTitle>
                    <CardDescription>CC (blue) and XCI (orange) over time med regime shading</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={regimeData.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('no-NO', { month: 'short', day: 'numeric' })} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cc" stroke="#3b82f6" name="CC" strokeWidth={2} />
                        <Line type="monotone" dataKey="xci" stroke="#f97316" name="XCI" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chart 2: FBI */}
                <Card>
                  <CardHeader>
                    <CardTitle>Liquidity Breadth Index (FBI)</CardTitle>
                    <CardDescription>% av banker med TO_Norm &gt; 1</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={regimeData.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('no-NO', { month: 'short', day: 'numeric' })} />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="fbi" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center text-muted-foreground">Ingen data tilgjengelig</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
