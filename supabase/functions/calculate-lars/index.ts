import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BANKS = [
  { name: 'DNB', ticker: 'DNB.OL' },
  { name: 'SB1 Sør-Norge', ticker: 'SB1NO.OL' },
  { name: 'Sparebanken Norge', ticker: 'SBNOR.OL' },
  { name: 'SB1 SMN', ticker: 'MING.OL' },
  { name: 'SB1 Østlandet', ticker: 'SPOL.OL' },
  { name: 'SB1 Nord-Norge', ticker: 'NONG.OL' },
  { name: 'Sparebanken Møre', ticker: 'MORG.OL' },
  { name: 'Sparebanken Øst', ticker: 'SPOG.OL' },
  { name: 'SB1 Helgeland', ticker: 'HELG.OL' },
  { name: 'Rogaland Sparebank', ticker: 'ROGS.OL' },
  { name: 'SB1 Ringerike Hadeland', ticker: 'RING.OL' },
  { name: 'SB1 Østfold Akershus', ticker: 'SOAG.OL' },
  { name: 'SB1 Nordmøre', ticker: 'SNOR.OL' },
  { name: 'Haugesund Sparebank', ticker: 'HGSB.OL' },
  { name: 'Jæren Sparebank', ticker: 'JAREN.OL' },
  { name: 'Aurskog Sparebank', ticker: 'AURG.OL' },
  { name: 'Skue Sparebank', ticker: 'SKUE.OL' },
  { name: 'Melhus Sparebank', ticker: 'MELG.OL' },
  { name: 'Sogn Sparebank', ticker: 'SOGN.OL' },
  { name: 'Høland og Setskog Sparebank', ticker: 'HSPG.OL' },
  { name: 'Voss Veksel- og Landmandsbank', ticker: 'VVL.OL' },
  { name: 'Bien Sparebank', ticker: 'BIEN.OL' },
];

const SHARES_OUTSTANDING: Record<string, number> = {
  'DNB.OL': 1549925408,
  'SB1NO.OL': 108651447,
  'SBNOR.OL': 177366888,
  'MING.OL': 165293730,
  'SPOL.OL': 92737765,
  'NONG.OL': 84925414,
  'MORG.OL': 49954895,
  'SPOG.OL': 45000000,
  'HELG.OL': 27000000,
  'ROGS.OL': 38000000,
  'RING.OL': 30000000,
  'SOAG.OL': 35000000,
  'SNOR.OL': 25000000,
  'HGSB.OL': 20000000,
  'JAREN.OL': 18000000,
  'AURG.OL': 15000000,
  'SKUE.OL': 12000000,
  'MELG.OL': 10000000,
  'SOGN.OL': 9000000,
  'HSPG.OL': 8000000,
  'VVL.OL': 7000000,
  'BIEN.OL': 6000000,
};

interface DailyData {
  date: string;
  close: number;
  volume: number;
}

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days - 30);

  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data for ${ticker}`);
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
      return [];
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const dailyData: DailyData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null && quotes.volume[i] !== null) {
        dailyData.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: quotes.close[i],
          volume: quotes.volume[i],
        });
      }
    }
    
    return dailyData;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return [];
  }
}

function calculateDailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
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

function calculateNormalizedTurnover(data: DailyData[], sharesOutstanding: number, windowSize = 30): number[] {
  const turnover = data.map(d => (d.close * d.volume) / (d.close * sharesOutstanding));
  const movingAvg = calculateMovingAverage(turnover, windowSize);
  return turnover.map((t, i) => movingAvg[i] === 0 ? 0 : t / movingAvg[i]);
}

function calculateSkewness(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / values.length;
  return skewness;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting LARS calculation...');
    
    const { days = 90 } = await req.json().catch(() => ({}));

    // Fetch historical data for all banks
    const allBankData = await Promise.all(
      BANKS.map(async (bank) => {
        const data = await fetchHistoricalData(bank.ticker, days);
        return { bank, data };
      })
    );

    const banksWithData = allBankData.filter(b => b.data.length > 30);
    console.log(`Fetched data for ${banksWithData.length} banks`);

    // Calculate normalized turnover and returns for each bank
    const bankMetrics = banksWithData.map(({ bank, data }) => {
      const normalizedTurnover = calculateNormalizedTurnover(data, SHARES_OUTSTANDING[bank.ticker]);
      const returns = calculateDailyReturns(data.map(d => d.close));
      
      return {
        ticker: bank.ticker,
        name: bank.name,
        data: data.slice(1).map((d, i) => ({
          date: d.date,
          return: returns[i] || 0,
          normalizedTurnover: normalizedTurnover[i + 1] || 0,
        })),
      };
    });

    // Get all unique dates
    const allDates = Array.from(new Set(bankMetrics.flatMap(b => b.data.map(d => d.date)))).sort();
    console.log(`Processing ${allDates.length} dates`);

    // Calculate LARS for each date
    const larsTimeSeries = allDates.map(date => {
      const banksOnDate = bankMetrics.filter(b => b.data.find(d => d.date === date));
      if (banksOnDate.length < 3) return null;

      const returns = banksOnDate.map(b => b.data.find(d => d.date === date)?.return || 0);
      const turnovers = banksOnDate.map(b => b.data.find(d => d.date === date)?.normalizedTurnover || 0);
      
      const avgTurnover = turnovers.reduce((a, b) => a + b, 0) / turnovers.length;
      
      // Calculate cross-sectional return skew
      const skewness = calculateSkewness(returns);
      
      // LARS = skewness * (1 / avg normalized turnover)
      const lars = avgTurnover === 0 ? 0 : skewness / avgTurnover;

      return {
        date,
        lars,
        skewness,
        avgNormalizedTurnover: avgTurnover,
      };
    }).filter(d => d !== null);

    // Calculate detrended LARS (remove 120-day rolling mean)
    const larsValues = larsTimeSeries.map(d => d.lars);
    const rollingMean = calculateMovingAverage(larsValues, Math.min(120, larsValues.length));
    const detrendedLARS = larsValues.map((val, i) => val - rollingMean[i]);
    
    // Calculate cumulative LARS
    let cumulativeSum = 0;
    const larsCumulative = detrendedLARS.map(val => {
      cumulativeSum += val;
      return cumulativeSum;
    });
    
    // Add cumulative values to time series
    const enhancedTimeSeries = larsTimeSeries.map((d, i) => ({
      ...d,
      larsCumulative: larsCumulative[i],
    }));

    const currentLARS = enhancedTimeSeries[enhancedTimeSeries.length - 1];

    // Calculate statistics for cumulative LARS
    const cumulativeValues = larsCumulative.slice(-days);
    const cumulativeMean = cumulativeValues.reduce((a, b) => a + b, 0) / cumulativeValues.length;
    
    function calculateStdDev(values: number[]): number {
      if (values.length === 0) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      return Math.sqrt(variance);
    }
    
    const cumulativeStdDev = calculateStdDev(cumulativeValues);
    
    function calculatePercentile(values: number[], percentile: number): number {
      const sorted = [...values].sort((a, b) => a - b);
      const index = (percentile / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
    
    const cumulativeStats = {
      mean: cumulativeMean,
      stdDev: cumulativeStdDev,
      upperBand: cumulativeMean + cumulativeStdDev,
      lowerBand: cumulativeMean - cumulativeStdDev,
      p90: calculatePercentile(cumulativeValues, 90),
      p10: calculatePercentile(cumulativeValues, 10),
    };

    console.log('LARS calculation completed successfully');

    return new Response(
      JSON.stringify({
        larsTimeSeries: enhancedTimeSeries.slice(-days),
        currentLARS: currentLARS || null,
        cumulativeStatistics: cumulativeStats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in LARS calculation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
