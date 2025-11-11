import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndicatorData {
  date: string;
  value: number;
}

interface ComponentData {
  date: string;
  csd: number;
  rotation: number;
  vdi: number;
  lars: number;
  smfi: number;
  relativePerformance: number;
}

function calculateZScore(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(val => (val - mean) / stdDev);
}

function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < Math.min(period, values.length); i++) {
    sum += values[i];
  }
  ema.push(sum / Math.min(period, values.length));
  
  // Calculate EMA for rest
  for (let i = 1; i < values.length; i++) {
    ema.push((values[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  
  return ema;
}

function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(avg);
  }
  
  return result;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function fetchIndicatorData(endpoint: string, days: number): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const url = `${supabaseUrl}/functions/v1/${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  
  if (!response.ok) throw new Error(`Failed to fetch ${endpoint} data`);
  
  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting SSI calculation...');
    
    const { days = 365 } = await req.json().catch(() => ({}));

    // Fetch all indicator data in parallel
    const [dispersionData, rotationData, vdiData, larsData, smfiData, performanceData] = await Promise.all([
      fetchIndicatorData('calculate-dispersion', days),
      fetchIndicatorData('calculate-rotation', days),
      fetchIndicatorData('calculate-vdi', days),
      fetchIndicatorData('calculate-lars', days),
      fetchIndicatorData('calculate-smfi', days),
      fetchIndicatorData('calculate-performance', days),
    ]);

    console.log('Fetched all indicator data');

    // Parse the responses to get time series
    const csdSeries = dispersionData.dispersionTimeSeries?.map((d: any) => ({ date: d.date, value: d.dispersion })) || [];
    const rotationSeries = rotationData.rotationTimeSeries?.map((d: any) => ({ date: d.date, value: d.rotationScore })) || [];
    const vdiSeries = vdiData.vdiTimeSeries?.map((d: any) => ({ date: d.date, value: d.vdi })) || [];
    const larsSeries = larsData.larsTimeSeries?.map((d: any) => ({ date: d.date, value: d.lars })) || [];
    const smfiSeries = smfiData.smfiTimeSeries?.map((d: any) => ({ date: d.date, value: d.smfi })) || [];
    const perfSeries = performanceData.performanceTimeSeries?.map((d: any) => ({ date: d.date, value: d.performanceDiff })) || [];

    // Find common dates
    const allDates = new Set<string>();
    [csdSeries, rotationSeries, vdiSeries, larsSeries, smfiSeries, perfSeries].forEach(series => {
      series.forEach((d: IndicatorData) => allDates.add(d.date));
    });

    const commonDates = Array.from(allDates)
      .filter(date => 
        csdSeries.some((d: IndicatorData) => d.date === date) &&
        rotationSeries.some((d: IndicatorData) => d.date === date) &&
        vdiSeries.some((d: IndicatorData) => d.date === date) &&
        larsSeries.some((d: IndicatorData) => d.date === date) &&
        smfiSeries.some((d: IndicatorData) => d.date === date) &&
        perfSeries.some((d: IndicatorData) => d.date === date)
      )
      .sort();

    console.log(`Found ${commonDates.length} common dates`);

    if (commonDates.length === 0) {
      throw new Error('No common dates found across all indicators');
    }

    // Extract values for common dates
    const csdValues = commonDates.map(date => csdSeries.find((d: IndicatorData) => d.date === date)!.value);
    const rotationValues = commonDates.map(date => rotationSeries.find((d: IndicatorData) => d.date === date)!.value);
    const vdiValues = commonDates.map(date => vdiSeries.find((d: IndicatorData) => d.date === date)!.value);
    const larsValues = commonDates.map(date => larsSeries.find((d: IndicatorData) => d.date === date)!.value);
    const smfiValues = commonDates.map(date => smfiSeries.find((d: IndicatorData) => d.date === date)!.value);
    const perfValues = commonDates.map(date => perfSeries.find((d: IndicatorData) => d.date === date)!.value);

    // Calculate z-scores
    const csdZ = calculateZScore(csdValues);
    const rotationZ = calculateZScore(rotationValues);
    const vdiZ = calculateZScore(vdiValues);
    const larsZ = calculateZScore(larsValues);
    const smfiZ = calculateZScore(smfiValues);
    const perfZ = calculateZScore(perfValues);

    // Combine with alignment (invert sign for rotation, lars, performance)
    const ssiRaw = commonDates.map((date, i) => {
      const components = {
        date,
        csd: csdZ[i],
        rotation: -rotationZ[i], // inverted
        vdi: vdiZ[i],
        lars: -larsZ[i], // inverted
        smfi: smfiZ[i],
        relativePerformance: -perfZ[i], // inverted
      };
      
      const raw = (components.csd + components.rotation + components.vdi + 
                   components.lars + components.smfi + components.relativePerformance) / 6;
      
      return { ...components, raw };
    });

    // Calculate 10-day EMA
    const rawValues = ssiRaw.map(d => d.raw);
    const emaValues = calculateEMA(rawValues, 10);

    // Calculate cumulative with 120-day rolling mean detrending
    const rollingMean120 = calculateMovingAverage(rawValues, 120);
    const detrendedValues = rawValues.map((val, i) => val - rollingMean120[i]);
    let cumulativeSum = 0;
    const cumulativeValues = detrendedValues.map(val => {
      cumulativeSum += val;
      return cumulativeSum;
    });

    // Build time series with all metrics
    const ssiTimeSeries = commonDates.map((date, i) => ({
      date,
      ssiRaw: rawValues[i],
      ssiEMA: emaValues[i],
      ssiCumulative: cumulativeValues[i],
      components: {
        csd: ssiRaw[i].csd,
        rotation: ssiRaw[i].rotation,
        vdi: ssiRaw[i].vdi,
        lars: ssiRaw[i].lars,
        smfi: ssiRaw[i].smfi,
        relativePerformance: ssiRaw[i].relativePerformance,
      },
    }));

    // Calculate statistics for EMA
    const emaMean = emaValues.reduce((a, b) => a + b, 0) / emaValues.length;
    const emaVariance = emaValues.reduce((sum, val) => sum + Math.pow(val - emaMean, 2), 0) / emaValues.length;
    const emaStdDev = Math.sqrt(emaVariance);

    // Calculate statistics for Cumulative
    const cumMean = cumulativeValues.reduce((a, b) => a + b, 0) / cumulativeValues.length;
    const cumVariance = cumulativeValues.reduce((sum, val) => sum + Math.pow(val - cumMean, 2), 0) / cumulativeValues.length;
    const cumStdDev = Math.sqrt(cumVariance);

    // Current values
    const current = ssiTimeSeries[ssiTimeSeries.length - 1];
    const fiveDaysAgo = ssiTimeSeries[Math.max(0, ssiTimeSeries.length - 5)];
    const fiveDayChange = current.ssiEMA - fiveDaysAgo.ssiEMA;

    // Sentiment label
    let sentiment = 'Nøytral';
    if (current.ssiEMA > 0.7) {
      sentiment = 'Defensiv / Risk-off';
    } else if (current.ssiEMA < -0.7) {
      sentiment = 'Risk-on';
    }

    // Percentiles for cumulative
    const cumP90 = calculatePercentile(cumulativeValues, 90);
    const cumP10 = calculatePercentile(cumulativeValues, 10);

    console.log('SSI calculation completed successfully');

    return new Response(
      JSON.stringify({
        ssiTimeSeries: ssiTimeSeries.slice(-days),
        currentSSI: current,
        fiveDayChange,
        sentiment,
        emaStatistics: {
          mean: emaMean,
          stdDev: emaStdDev,
          upperBand: emaMean + emaStdDev,
          lowerBand: emaMean - emaStdDev,
        },
        cumulativeStatistics: {
          mean: cumMean,
          stdDev: cumStdDev,
          upperBand: cumMean + cumStdDev,
          lowerBand: cumMean - cumStdDev,
          p90: cumP90,
          p10: cumP10,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in SSI calculation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
