import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from "recharts";
import { exportToExcel } from "@/utils/excelExport";

type MomentumData = {
  ticker: string;
  name: string;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  rsi: number;
  ma50: number;
  ma200: number;
  current_price: number;
  golden_cross: number;
};

type Period = 30 | 180 | 365;

const INDICATORS = [
  { value: "macd", label: "MACD" },
  { value: "macd_histogram", label: "MACD Histogram" },
  { value: "rsi", label: "RSI" },
  { value: "ma50", label: "MA50" },
  { value: "ma200", label: "MA200" },
  { value: "golden_cross", label: "Golden Cross (%)" },
];


export default function Momentum() {
  const [period, setPeriod] = useState<Period>(180);
  const [xAxis, setXAxis] = useState("rsi");
  const [yAxis, setYAxis] = useState("macd");

  const { data, isLoading, error } = useQuery({
    queryKey: ["momentum", period],
    queryFn: async () => {
      console.log('🔍 Fetching momentum data from edge function...');
      console.log('📅 Period:', period, 'days');
      
      const { data: responseData, error } = await supabase.functions.invoke("calculate-momentum", {
        body: { days: period },
      });
      
      console.log('📦 Raw response from edge function:', responseData);
      console.log('❌ Response error:', error);
      
      if (error) {
        console.error('🚨 Supabase function error:', error);
        throw error;
      }
      if (!responseData?.success) {
        console.error('🚨 Edge function returned error:', responseData?.error);
        throw new Error(responseData?.error || 'Unknown error');
      }
      
      const momentum = responseData?.momentum as MomentumData[];
      console.log("✅ Momentum data received:", momentum?.length, "banks");
      console.log("📊 Sample data point:", momentum?.[0]);
      
      return momentum;
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  console.log("useQuery data:", data);
  console.log("isLoading:", isLoading);
  console.log("error:", error);

  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    const exportData = data.map(row => ({
      Ticker: row.ticker,
      Pris: row.current_price.toFixed(2),
      MACD: row.macd.toFixed(3),
      'MACD Signal': row.macd_signal.toFixed(3),
      'MACD Histogram': row.macd_histogram.toFixed(3),
      RSI: row.rsi.toFixed(1),
      MA50: row.ma50.toFixed(2),
      MA200: row.ma200.toFixed(2),
      'Golden Cross (%)': row.golden_cross.toFixed(1),
    }));
    
    exportToExcel(exportData, `Momentum_${period}dager`, 'Momentum Indikatorer');
  };

  const getColor = (value: number, indicator: string) => {
    if (indicator === "rsi") {
      if (value > 70) return "hsl(var(--destructive))";
      if (value < 30) return "hsl(var(--chart-2))";
      return "hsl(var(--muted-foreground))";
    }
    if (indicator === "macd" || indicator === "macd_histogram") {
      return value > 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
    }
    if (indicator === "golden_cross") {
      return value > 0 ? "hsl(var(--chart-2))" : "hsl(var(--muted-foreground))";
    }
    return "hsl(var(--primary))";
  };

  const scatterData = data?.map((item) => ({
    ...item,
    name: item.name,
    ticker: item.ticker,
    x: Number(item[xAxis as keyof MomentumData]),
    y: Number(item[yAxis as keyof MomentumData]),
  })).filter(item => !isNaN(item.x) && !isNaN(item.y));

  console.log("Scatter data points:", scatterData?.length);
  console.log("Sample point:", scatterData?.[0]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Momentum Indikator</h1>
        <p className="text-muted-foreground">
          Teknisk analyse med MACD, RSI, bevegelige gjennomsnitt og Golden Cross
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          📊 Data hentet fra Yahoo Finance API i sanntid • Beregnet for 22 norske sparebanker
        </p>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v) as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Siste 30 dager</SelectItem>
            <SelectItem value="180">Siste 180 dager</SelectItem>
            <SelectItem value="365">Siste 365 dager</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleExport} disabled={!data || data.length === 0} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Last ned Excel
        </Button>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">X-akse:</span>
          <Select value={xAxis} onValueChange={setXAxis}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDICATORS.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Y-akse:</span>
          <Select value={yAxis} onValueChange={setYAxis}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDICATORS.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Feil ved lasting av data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'Kunne ikke laste momentum-data. Prøv igjen senere.'}
            </p>
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ingen data tilgjengelig</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Ingen momentum-data funnet for valgt periode.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {INDICATORS.find((i) => i.value === yAxis)?.label} vs{" "}
                {INDICATORS.find((i) => i.value === xAxis)?.label}
              </CardTitle>
              <CardDescription>
                Scatter plot for å identifisere banker med sterke tekniske signaler
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!scatterData || scatterData.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  Ingen data tilgjengelig for valgt periode
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={INDICATORS.find((i) => i.value === xAxis)?.label}
                      stroke="hsl(var(--foreground))"
                      label={{ 
                        value: INDICATORS.find((i) => i.value === xAxis)?.label, 
                        position: 'insideBottom', 
                        offset: -10,
                        style: { fill: 'hsl(var(--foreground))' }
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={INDICATORS.find((i) => i.value === yAxis)?.label}
                      stroke="hsl(var(--foreground))"
                      label={{ 
                        value: INDICATORS.find((i) => i.value === yAxis)?.label, 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fill: 'hsl(var(--foreground))' }
                      }}
                    />
                    <ZAxis range={[200, 200]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold mb-2">{data.name}</p>
                              <p className="text-sm">
                                {INDICATORS.find((i) => i.value === xAxis)?.label}: {data.x?.toFixed(2)}
                              </p>
                              <p className="text-sm">
                                {INDICATORS.find((i) => i.value === yAxis)?.label}: {data.y?.toFixed(2)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={scatterData} fill="hsl(var(--primary))">
                      {scatterData?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColor(entry.y, yAxis)} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alle tekniske indikatorer</CardTitle>
              <CardDescription>Komplett oversikt over momentum-signaler</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                    <TableHead className="text-right">MACD</TableHead>
                    <TableHead className="text-right">MACD Signal</TableHead>
                    <TableHead className="text-right">MACD Hist</TableHead>
                    <TableHead className="text-right">RSI</TableHead>
                    <TableHead className="text-right">MA50</TableHead>
                    <TableHead className="text-right">MA200</TableHead>
                    <TableHead className="text-right">Golden Cross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((row) => (
                    <TableRow key={row.ticker}>
                      <TableCell className="font-medium">{row.ticker}</TableCell>
                      <TableCell className="text-right">{row.current_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right" style={{ color: getColor(row.macd, "macd") }}>
                        {row.macd.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right">{row.macd_signal.toFixed(3)}</TableCell>
                      <TableCell
                        className="text-right font-semibold"
                        style={{ color: getColor(row.macd_histogram, "macd_histogram") }}
                      >
                        {row.macd_histogram.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right" style={{ color: getColor(row.rsi, "rsi") }}>
                        {row.rsi.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">{row.ma50.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.ma200.toFixed(2)}</TableCell>
                      <TableCell
                        className="text-right font-semibold"
                        style={{ color: getColor(row.golden_cross, "golden_cross") }}
                      >
                        {row.golden_cross > 0 ? "✓ " : "✗ "}
                        {row.golden_cross.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
