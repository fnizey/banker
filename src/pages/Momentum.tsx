import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from "recharts";

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

const BANK_NAMES: Record<string, string> = {
  "SB1NO.OL": "SB1 Sør-Norge",
  "SBNOR.OL": "Sparebanken Norge",
  "MING.OL": "SB1 SMN",
  "SPOL.OL": "Sparebanken Øst",
  "NONG.OL": "SB1 Nord-Norge",
  "MORG.OL": "Morg",
  "SPOG.OL": "Sparebanken Vest",
  "HELG.OL": "Helgeland Sparebank",
  "ROGS.OL": "Rogs",
  "RING.OL": "Ringkjøbing",
  "SOAG.OL": "Soag",
  "SNOR.OL": "SB1 Nordmøre",
  "HGSB.OL": "Holand og Setskog",
  "JAREN.OL": "Jæren",
  "AURG.OL": "Aurskog",
  "SKUE.OL": "Skue",
  "MELG.OL": "Melhus",
  "SOGN.OL": "Sogn",
  "HSPG.OL": "Hemne",
  "VVL.OL": "Voss Veksel",
  "BIEN.OL": "Bien",
};

export default function Momentum() {
  const [period, setPeriod] = useState<Period>(180);
  const [xAxis, setXAxis] = useState("rsi");
  const [yAxis, setYAxis] = useState("macd");

  const { data, isLoading } = useQuery({
    queryKey: ["momentum", period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-momentum", {
        body: { days: period },
      });
      if (error) throw error;
      return data.momentum as MomentumData[];
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Momentum Indikator</h1>
        <p className="text-muted-foreground">
          Teknisk analyse med MACD, RSI, bevegelige gjennomsnitt og Golden Cross
        </p>
      </div>

      <div className="flex gap-4 items-center">
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
                    <TableHead>Bank</TableHead>
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
                      <TableCell className="font-medium">{BANK_NAMES[row.ticker]}</TableCell>
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
