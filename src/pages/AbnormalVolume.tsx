import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface VolumeData {
  ticker: string;
  name: string;
  currentVolume: number;
  avgVolume: number;
  zScore: number;
  status: 'Normal' | 'Moderate' | 'Abnormal';
}

const AbnormalVolume = () => {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchVolumeData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-abnormal-volume', {
        body: { days: 60 }
      });

      if (error) throw error;

      if (data.success) {
        setVolumeData(data.volumeData);
        setLastUpdated(new Date());
        
        toast({
          title: "Data hentet",
          description: "Volumanalyse oppdatert",
        });
      }
    } catch (error) {
      console.error('Error fetching volume data:', error);
      toast({
        title: "Feil ved henting",
        description: "Kunne ikke laste volumdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolumeData();
  }, []);

  const filteredData = showAbnormalOnly 
    ? volumeData.filter(d => d.status === 'Abnormal')
    : volumeData;

  const sortedData = [...filteredData].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      'Normal': { variant: 'default', label: 'Normal' },
      'Moderate': { variant: 'secondary', label: 'Moderat' },
      'Abnormal': { variant: 'destructive', label: 'Unormal' }
    };
    
    const config = variants[status] || variants['Normal'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBarColor = (zScore: number) => {
    const absZ = Math.abs(zScore);
    if (absZ >= 2) return 'hsl(var(--destructive))';
    if (absZ >= 1) return 'hsl(var(--accent))';
    return 'hsl(var(--primary))';
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(0)}K`;
    return volume.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              🔔 Abnormal Volume
            </h1>
            <p className="text-muted-foreground mt-2">
              Oppdager banker med uvanlig høyt handelsvolum sammenlignet med 30-dagers gjennomsnitt
            </p>
          </div>
          <Button onClick={fetchVolumeData} disabled={loading} className="shadow-lg hover:shadow-xl transition-shadow">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Oppdater data
          </Button>
        </div>

        <div className="space-y-6">
          {/* Filter Toggle */}
          <Card className="p-4 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="font-medium">
                  Abnormale banker: {volumeData.filter(d => d.status === 'Abnormal').length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="abnormal-only"
                  checked={showAbnormalOnly}
                  onCheckedChange={setShowAbnormalOnly}
                />
                <Label htmlFor="abnormal-only" className="cursor-pointer">
                  Vis kun abnormale (|z| ≥ 2)
                </Label>
              </div>
            </div>
          </Card>

          {/* Z-Score Bar Chart */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <h2 className="text-2xl font-bold mb-4">Z-Score per bank</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Viser hvor mange standardavvik dagens volum er fra 30-dagers gjennomsnittet
            </p>
            {loading && volumeData.length === 0 ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={sortedData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="ticker" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    label={{ value: 'Z-Score', angle: -90, position: 'insideLeft' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(2), 'Z-Score']}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="zScore" name="Z-Score" radius={[8, 8, 0, 0]}>
                    {sortedData.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.zScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Volume Data Table */}
          <Card className="p-6 shadow-lg border-2 bg-gradient-to-br from-card via-card to-accent/5">
            <h2 className="text-2xl font-bold mb-4">Volumdetaljer</h2>
            {loading && volumeData.length === 0 ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead className="text-right">Dagens volum</TableHead>
                      <TableHead className="text-right">30d gjennomsnitt</TableHead>
                      <TableHead className="text-right">Z-Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Ingen data tilgjengelig
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedData.map((row) => (
                        <TableRow key={row.ticker}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.ticker}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatVolume(row.currentVolume)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatVolume(row.avgVolume)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {row.zScore.toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Legend */}
          <Card className="p-4 shadow-lg border-2 bg-gradient-to-br from-accent/5 to-card">
            <h3 className="font-semibold mb-2">Klassifisering:</h3>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default">Normal</Badge>
                <span className="text-muted-foreground">|z| &lt; 1</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Moderat</Badge>
                <span className="text-muted-foreground">1 ≤ |z| &lt; 2</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Unormal</Badge>
                <span className="text-muted-foreground">|z| ≥ 2</span>
              </div>
            </div>
          </Card>

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

export default AbnormalVolume;
