import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

interface SSIData {
  ssiEMA: number;
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
  const [selectedDays, setSelectedDays] = useState<number>(60);

  // Statistical transformation functions
  const fisherZ = (r: number): number => {
    const clipped = Math.max(-0.999, Math.min(0.999, r));
    return 0.5 * Math.log((1 + clipped) / (1 - clipped));
  };

  const logit = (p: number): number => {
    const clipped = Math.max(0.001, Math.min(0.999, p));
    return Math.log(clipped / (1 - clipped));
  };

  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const mad = (values: number[], medianVal: number): number => {
    const deviations = values.map(v => Math.abs(v - medianVal));
    return median(deviations);
  };

  const robustZScore = (value: number, values: number[]): number => {
    if (values.length < 10) return 0;
    const med = median(values);
    const madVal = mad(values, med);
    if (madVal === 0) return 0;
    return (value - med) / (1.4826 * madVal);
  };

  const winsorize = (z: number, limit: number = 3): number => {
    return Math.max(-limit, Math.min(limit, z));
  };

  const tanhScale = (z: number): number => {
    return 0.5 + 0.5 * Math.tanh(z / 2);
  };

  const calculateEMA = (values: number[], period: number): number[] => {
    if (values.length === 0) return [];
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    ema[0] = values[0];
    for (let i = 1; i < values.length; i++) {
      ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema;
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

  const calculateAORITimeSeries = (
    ssiData: any,
    regimeData: any,
    larsData: any,
    smfiData: any
  ): { timeSeries: AORIPoint[]; latestComponents: ComponentContribution[] } => {
    // Build raw component arrays
    const minLength = Math.min(
      ssiData.ssiTimeSeries?.length || 0,
      regimeData.timeSeries?.length || 0,
      larsData.larsTimeSeries?.length || 0,
      smfiData.smfiTimeSeries?.length || 0
    );

    if (minLength === 0) {
      return { timeSeries: [], latestComponents: [] };
    }

    // Extract raw values
    const rawSentiment: number[] = [];
    const rawCorrDisp: number[] = [];
    const rawLiqBreadth: number[] = [];
    const rawAsymmetry: number[] = [];
    const rawRotation: number[] = [];
    const dates: string[] = [];

    for (let i = 0; i < minLength; i++) {
      const ssiPoint = ssiData.ssiTimeSeries[i];
      const regimePoint = regimeData.timeSeries[i];
      const larsPoint = larsData.larsTimeSeries[i];
      const smfiPoint = smfiData.smfiTimeSeries[i];

      // Sentiment = SSI_EMA + 5-day delta (only for last point)
      const delta = i === minLength - 1 ? (ssiData.fiveDayChange || 0) : 0;
      rawSentiment.push(ssiPoint.ssiEMA + delta);

      // Correlation Dispersion = Fisher-z(XCI) - Fisher-z(CC)
      rawCorrDisp.push(fisherZ(regimePoint.xci) - fisherZ(regimePoint.cc));

      // Liquidity Breadth = logit(FBI)
      rawLiqBreadth.push(logit(regimePoint.fbi / 100));

      // Asymmetry = LARS
      rawAsymmetry.push(larsPoint.larsCumulative);

      // Rotation = SMFI
      rawRotation.push(smfiPoint.smfi);

      dates.push(ssiPoint.date);
    }

    // Calculate rolling 252-day robust z-scores and normalize
    const normalizedSentiment: number[] = [];
    const normalizedCorrDisp: number[] = [];
    const normalizedLiqBreadth: number[] = [];
    const normalizedAsymmetry: number[] = [];
    const normalizedRotation: number[] = [];

    const lookback = 252;

    for (let i = 0; i < minLength; i++) {
      const start = Math.max(0, i - lookback + 1);
      const window = i - start + 1;

      if (window >= 10) {
        // Sentiment
        const zSent = robustZScore(rawSentiment[i], rawSentiment.slice(start, i + 1));
        const wSent = winsorize(zSent);
        normalizedSentiment.push(tanhScale(wSent));

        // Correlation Dispersion
        const zCorr = robustZScore(rawCorrDisp[i], rawCorrDisp.slice(start, i + 1));
        const wCorr = winsorize(zCorr);
        normalizedCorrDisp.push(tanhScale(wCorr));

        // Liquidity Breadth
        const zLiq = robustZScore(rawLiqBreadth[i], rawLiqBreadth.slice(start, i + 1));
        const wLiq = winsorize(zLiq);
        normalizedLiqBreadth.push(tanhScale(wLiq));

        // Asymmetry
        const zAsym = robustZScore(rawAsymmetry[i], rawAsymmetry.slice(start, i + 1));
        const wAsym = winsorize(zAsym);
        normalizedAsymmetry.push(tanhScale(wAsym));

        // Rotation (inverted: high SMFI = risk-off = low alpha)
        const zRot = robustZScore(rawRotation[i], rawRotation.slice(start, i + 1));
        const wRot = winsorize(zRot);
        normalizedRotation.push(1 - tanhScale(wRot));
      } else {
        normalizedSentiment.push(0.5);
        normalizedCorrDisp.push(0.5);
        normalizedLiqBreadth.push(0.5);
        normalizedAsymmetry.push(0.5);
        normalizedRotation.push(0.5);
      }
    }

    // Apply 10-day EMA smoothing
    const emaSentiment = calculateEMA(normalizedSentiment, 10);
    const emaCorrDisp = calculateEMA(normalizedCorrDisp, 10);
    const emaLiqBreadth = calculateEMA(normalizedLiqBreadth, 10);
    const emaAsymmetry = calculateEMA(normalizedAsymmetry, 10);
    const emaRotation = calculateEMA(normalizedRotation, 10);

    // Calculate AORI with dynamic re-weighting
    const baseWeights = {
      sentiment: 0.25,
      correlation: 0.25,
      breadth: 0.20,
      asymmetry: 0.15,
      rotation: 0.15
    };

    const timeSeries: AORIPoint[] = [];

    for (let i = 0; i < minLength; i++) {
      const components = [
        { name: 'sentiment', value: emaSentiment[i], weight: baseWeights.sentiment },
        { name: 'correlation', value: emaCorrDisp[i], weight: baseWeights.correlation },
        { name: 'breadth', value: emaLiqBreadth[i], weight: baseWeights.breadth },
        { name: 'asymmetry', value: emaAsymmetry[i], weight: baseWeights.asymmetry },
        { name: 'rotation', value: emaRotation[i], weight: baseWeights.rotation }
      ];

      // Filter out missing components and re-weight
      const validComponents = components.filter(c => !isNaN(c.value) && isFinite(c.value));
      const totalWeight = validComponents.reduce((sum, c) => sum + c.weight, 0);

      let aori = 0;
      if (totalWeight > 0) {
        aori = validComponents.reduce((sum, c) => sum + (c.value * c.weight / totalWeight), 0) * 100;
      }

      aori = Math.max(0, Math.min(100, aori));

      timeSeries.push({
        date: dates[i],
        aori: Number(aori.toFixed(2)),
        interpretation: getInterpretation(aori)
      });
    }

    // Build latest components for breakdown table
    const lastIdx = minLength - 1;
    const latestComponents: ComponentContribution[] = [
      {
        factor: 'Sentiment',
        value: rawSentiment[lastIdx],
        normalized: emaSentiment[lastIdx],
        weight: baseWeights.sentiment,
        contribution: emaSentiment[lastIdx] * baseWeights.sentiment
      },
      {
        factor: 'Correlation Dispersion',
        value: rawCorrDisp[lastIdx],
        normalized: emaCorrDisp[lastIdx],
        weight: baseWeights.correlation,
        contribution: emaCorrDisp[lastIdx] * baseWeights.correlation
      },
      {
        factor: 'Liquidity Breadth',
        value: rawLiqBreadth[lastIdx],
        normalized: emaLiqBreadth[lastIdx],
        weight: baseWeights.breadth,
        contribution: emaLiqBreadth[lastIdx] * baseWeights.breadth
      },
      {
        factor: 'Asymmetry (LARS)',
        value: rawAsymmetry[lastIdx],
        normalized: emaAsymmetry[lastIdx],
        weight: baseWeights.asymmetry,
        contribution: emaAsymmetry[lastIdx] * baseWeights.asymmetry
      },
      {
        factor: 'Rotation (SMFI)',
        value: rawRotation[lastIdx],
        normalized: emaRotation[lastIdx],
        weight: baseWeights.rotation,
        contribution: emaRotation[lastIdx] * baseWeights.rotation
      }
    ];

    return { timeSeries, latestComponents };
  };

  useEffect(() => {
    fetchAORIData();
  }, [selectedDays]);

  const fetchAORIData = async () => {
    setLoading(true);
    try {
      // Fetch data with buffer for 252-day rolling window
      const fetchDays = selectedDays + 252;
      // Limit regime-correlation to max 180 days to avoid CPU timeout
      const regimeDays = Math.min(selectedDays, 180);
      
      const [ssiRes, regimeRes, larsRes, smfiRes] = await Promise.all([
        supabase.functions.invoke('calculate-ssi', { body: { days: fetchDays } }),
        supabase.functions.invoke('calculate-regime-correlation', { body: { days: regimeDays } }),
        supabase.functions.invoke('calculate-lars', { body: { days: fetchDays } }),
        supabase.functions.invoke('calculate-smfi', { body: { days: fetchDays } })
      ]);

      if (ssiRes.error || regimeRes.error || larsRes.error || smfiRes.error) {
        throw new Error('Failed to fetch data');
      }

      const ssiData = ssiRes.data;
      const regimeData = regimeRes.data;
      const larsData = larsRes.data;
      const smfiData = smfiRes.data;

      const { timeSeries, latestComponents } = calculateAORITimeSeries(
        ssiData,
        regimeData,
        larsData,
        smfiData
      );

      if (timeSeries.length > 0) {
        // Take only the selected period for display
        const displaySeries = timeSeries.slice(-selectedDays);
        setAoriTimeSeries(displaySeries);
        
        const latest = timeSeries[timeSeries.length - 1];
        setCurrentAORI(latest.aori);
        setInterpretation(latest.interpretation);
        setComponents(latestComponents);
      }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alpha Opportunity Regime Index (AORI)</h1>
          <p className="text-muted-foreground">
            Robust z-score composite combining sentiment, correlation, liquidity, asymmetry and rotation to quantify idiosyncratic alpha availability (0–100).
          </p>
        </div>
        <div className="flex gap-2">
          {[60, 180, 365].map((days) => (
            <Button
              key={days}
              variant={selectedDays === days ? 'default' : 'outline'}
              onClick={() => setSelectedDays(days)}
              size="sm"
            >
              {days}d
            </Button>
          ))}
        </div>
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
          <CardTitle>AORI EMA Trend ({Math.min(90, selectedDays)} Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aoriTimeSeries.slice(-90)}>
              <defs>
                <linearGradient id="aoriGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(180, 70%, 40%)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="hsl(180, 70%, 40%)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
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
                formatter={(value: number, name: string, props: any) => [
                  `${value.toFixed(1)}`,
                  'AORI',
                  props.payload.interpretation
                ]}
                labelFormatter={(label) => `Dato: ${label}`}
              />
              <ReferenceLine y={70} stroke="hsl(var(--success))" strokeDasharray="3 3" label="High Alpha" />
              <ReferenceLine y={35} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Low Alpha" />
              <Line 
                type="monotone" 
                dataKey="aori" 
                stroke="hsl(180, 70%, 40%)"
                strokeWidth={3}
                dot={false}
                fill="url(#aoriGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Rising AORI (blue-green) indicates expanding alpha opportunities and lower crowding. 
            Falling AORI (red-gray zone) signals defensive positioning.
          </p>
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
