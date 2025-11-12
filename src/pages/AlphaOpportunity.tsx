import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

interface SSIData {
  ssi_ema: number;
  delta_5d: number;
}

interface RegimeData {
  cc: number;
  xci: number;
  fbi: number;
}

interface AORIPoint {
  date: string;
  aori: number;
  interpretation: string;
}

interface ComponentContribution {
  factor: string;
  value: number;
  normalized: number;
  weight: number;
  contribution: number;
}

const AlphaOpportunity = () => {
  const [loading, setLoading] = useState(true);
  const [currentAORI, setCurrentAORI] = useState<number>(0);
  const [interpretation, setInterpretation] = useState<string>('');
  const [aoriTimeSeries, setAoriTimeSeries] = useState<AORIPoint[]>([]);
  const [components, setComponents] = useState<ComponentContribution[]>([]);

  const sigmoid = (x: number): number => {
    return 1 / (1 + Math.exp(-x));
  };

  const getInterpretation = (aori: number): string => {
    if (aori > 75) return "High alpha environment — dispersion and sentiment rising.";
    if (aori > 55) return "Moderate alpha regime — selective stock-picking pays.";
    if (aori > 35) return "Neutral — limited differentiation.";
    return "Crowded or defensive market — little alpha availability.";
  };

  const getGaugeColor = (aori: number): string => {
    if (aori > 70) return "hsl(var(--success))";
    if (aori > 35) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const calculateAORI = (
    ssi_ema: number,
    ssi_delta: number,
    cc: number,
    xci: number,
    fbi: number,
    lars: number,
    smfi: number
  ): { aori: number; components: ComponentContribution[] } => {
    // Normalize inputs
    const nSSI = sigmoid(ssi_ema + ssi_delta);
    const nCORR = 1 - (cc / (xci + 1e-6));
    const nFBI = Math.min(Math.max(fbi / 100, 0), 1);
    const nLARS = 0.5 + 0.5 * Math.tanh(lars);
    const nSMFI = 0.5 - 0.5 * Math.tanh(smfi);

    // Calculate contributions
    const weights = {
      sentiment: 0.25,
      correlation: 0.25,
      breadth: 0.20,
      asymmetry: 0.15,
      rotation: 0.15
    };

    const components: ComponentContribution[] = [
      {
        factor: 'Sentiment',
        value: ssi_ema + ssi_delta,
        normalized: nSSI,
        weight: weights.sentiment,
        contribution: nSSI * weights.sentiment
      },
      {
        factor: 'Correlation Dispersion',
        value: cc / (xci + 1e-6),
        normalized: nCORR,
        weight: weights.correlation,
        contribution: nCORR * weights.correlation
      },
      {
        factor: 'Liquidity Breadth',
        value: fbi,
        normalized: nFBI,
        weight: weights.breadth,
        contribution: nFBI * weights.breadth
      },
      {
        factor: 'Asymmetry (LARS)',
        value: lars,
        normalized: nLARS,
        weight: weights.asymmetry,
        contribution: nLARS * weights.asymmetry
      },
      {
        factor: 'Rotation (SMFI)',
        value: smfi,
        normalized: nSMFI,
        weight: weights.rotation,
        contribution: nSMFI * weights.rotation
      }
    ];

    const aori = Math.min(Math.max(
      100 * (
        weights.sentiment * nSSI +
        weights.correlation * nCORR +
        weights.breadth * nFBI +
        weights.asymmetry * nLARS +
        weights.rotation * nSMFI
      ),
      0
    ), 100);

    return { aori, components };
  };

  useEffect(() => {
    fetchAORIData();
  }, []);

  const fetchAORIData = async () => {
    setLoading(true);
    try {
      // Fetch all required data
      const [ssiRes, regimeRes, larsRes, smfiRes] = await Promise.all([
        supabase.functions.invoke('calculate-ssi', { body: { days: 60 } }),
        supabase.functions.invoke('calculate-regime-correlation', { body: { days: 60 } }),
        supabase.functions.invoke('calculate-lars', { body: { days: 60 } }),
        supabase.functions.invoke('calculate-smfi', { body: { days: 60 } })
      ]);

      if (ssiRes.error || regimeRes.error || larsRes.error || smfiRes.error) {
        throw new Error('Failed to fetch data');
      }

      const ssiData = ssiRes.data;
      const regimeData = regimeRes.data;
      const larsData = larsRes.data;
      const smfiData = smfiRes.data;

      // Build time series
      const timeSeries: AORIPoint[] = [];
      const minLength = Math.min(
        ssiData.ssiTimeSeries?.length || 0,
        regimeData.timeSeries?.length || 0,
        larsData.larsTimeSeries?.length || 0,
        smfiData.smfiTimeSeries?.length || 0
      );

      for (let i = 0; i < minLength; i++) {
        const ssiPoint = ssiData.ssiTimeSeries[i];
        const regimePoint = regimeData.timeSeries[i];
        const larsPoint = larsData.larsTimeSeries[i];
        const smfiPoint = smfiData.smfiTimeSeries[i];

        const { aori } = calculateAORI(
          ssiPoint.ssi_ema,
          i === minLength - 1 ? (ssiData.fiveDayChange || 0) : 0,
          regimePoint.cc,
          regimePoint.xci,
          regimePoint.fbi,
          larsPoint.larsCumulative,
          smfiPoint.smfi
        );

        timeSeries.push({
          date: ssiPoint.date,
          aori: Number(aori.toFixed(2)),
          interpretation: getInterpretation(aori)
        });
      }

      // Set current values
      if (timeSeries.length > 0) {
        const latest = timeSeries[timeSeries.length - 1];
        const latestSSI = ssiData.ssiTimeSeries[ssiData.ssiTimeSeries.length - 1];
        const latestRegime = regimeData.timeSeries[regimeData.timeSeries.length - 1];
        const latestLARS = larsData.larsTimeSeries[larsData.larsTimeSeries.length - 1];
        const latestSMFI = smfiData.smfiTimeSeries[smfiData.smfiTimeSeries.length - 1];

        const { aori, components } = calculateAORI(
          latestSSI.ssi_ema,
          ssiData.fiveDayChange || 0,
          latestRegime.cc,
          latestRegime.xci,
          latestRegime.fbi,
          latestLARS.larsCumulative,
          latestSMFI.smfi
        );

        setCurrentAORI(aori);
        setInterpretation(getInterpretation(aori));
        setComponents(components);
      }

      setAoriTimeSeries(timeSeries);
    } catch (error) {
      console.error('Error fetching AORI data:', error);
      toast.error('Kunne ikke hente AORI-data');
    } finally {
      setLoading(false);
    }
  };

  const GaugeChart = ({ value }: { value: number }) => {
    const radius = 80;
    const strokeWidth = 16;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-48 h-48 mx-auto">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="hsl(var(--muted))"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <motion.circle
            stroke={getGaugeColor(value)}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <motion.span
            className="text-4xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {value.toFixed(1)}
          </motion.span>
          <span className="text-sm text-muted-foreground">AORI</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-6"
    >
      <div>
        <h1 className="text-3xl font-bold mb-2">Alpha Opportunity Regime Index (AORI)</h1>
        <p className="text-muted-foreground">
          Composite index combining sentiment, correlation, liquidity, asymmetry and capital rotation to quantify idiosyncratic alpha availability (0–100).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <Card>
          <CardHeader>
            <CardTitle>Current AORI</CardTitle>
          </CardHeader>
          <CardContent>
            <GaugeChart value={currentAORI} />
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                   style={{ backgroundColor: getGaugeColor(currentAORI) + '20', color: getGaugeColor(currentAORI) }}>
                {currentAORI > 70 ? '🟢' : currentAORI > 35 ? '🟠' : '🔴'}
                {currentAORI > 70 ? 'High Alpha' : currentAORI > 35 ? 'Moderate Alpha' : 'Low Alpha'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interpretation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interpretation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">{interpretation}</p>
            
            <div className="grid grid-cols-3 gap-2 pt-4">
              <div className="text-center p-2 rounded" style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}>
                <div className="text-sm text-muted-foreground">0–35</div>
                <div className="text-xs">Crowded</div>
              </div>
              <div className="text-center p-2 rounded" style={{ backgroundColor: 'hsl(var(--warning) / 0.1)' }}>
                <div className="text-sm text-muted-foreground">35–70</div>
                <div className="text-xs">Moderate</div>
              </div>
              <div className="text-center p-2 rounded" style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}>
                <div className="text-sm text-muted-foreground">70–100</div>
                <div className="text-xs">High Alpha</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>AORI Trend (60 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aoriTimeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}`, 'AORI']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <ReferenceLine y={70} stroke="hsl(var(--success))" strokeDasharray="3 3" />
              <ReferenceLine y={35} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Line 
                type="monotone" 
                dataKey="aori" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Component Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Component Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4">Factor</th>
                  <th className="text-right py-2 px-4">Value</th>
                  <th className="text-right py-2 px-4">Normalized</th>
                  <th className="text-right py-2 px-4">Weight</th>
                  <th className="text-right py-2 px-4">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 px-4">{comp.factor}</td>
                    <td className="text-right py-2 px-4">{comp.value.toFixed(3)}</td>
                    <td className="text-right py-2 px-4">{comp.normalized.toFixed(3)}</td>
                    <td className="text-right py-2 px-4">{(comp.weight * 100).toFixed(0)}%</td>
                    <td className="text-right py-2 px-4">{(comp.contribution * 100).toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-border">
                  <td className="py-2 px-4">AORI Total</td>
                  <td className="text-right py-2 px-4">—</td>
                  <td className="text-right py-2 px-4">—</td>
                  <td className="text-right py-2 px-4">100%</td>
                  <td className="text-right py-2 px-4">{currentAORI.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AlphaOpportunity;
