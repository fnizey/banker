import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

// Shares outstanding data (hardcoded)
const SHARES_OUTSTANDING: Record<string, number> = {
  'DNB.OL': 1600000000,
  'SB1NO.OL': 375460000,
  'SBNOR.OL': 149805902,
  'MING.OL': 144207760,
  'SPOL.OL': 135860724,
  'NONG.OL': 100398016,
  'MORG.OL': 49623779,
  'SPOG.OL': 20731183,
  'HELG.OL': 26947021,
  'ROGS.OL': 22997885,
  'RING.OL': 15650405,
  'SOAG.OL': 12387741,
  'SNOR.OL': 9061837,
  'HGSB.OL': 2250000,
  'JAREN.OL': 4932523,
  'AURG.OL': 4622601,
  'SKUE.OL': 2278895,
  'MELG.OL': 2776225,
  'SOGN.OL': 632500,
  'HSPG.OL': 687900,
  'VVL.OL': 2203716,
  'BIEN.OL': 5680198,
};

// Fixed bank categorization
const BANK_CATEGORIES: Record<string, 'Small' | 'Mid' | 'Large'> = {
  // Store banker
  'DNB.OL': 'Large',
  'SB1NO.OL': 'Large',
  'SBNOR.OL': 'Large',
  'MING.OL': 'Large',
  'SPOL.OL': 'Large',
  'NONG.OL': 'Large',
  'MORG.OL': 'Large',
  // Mellomstore banker
  'SPOG.OL': 'Mid',
  'HELG.OL': 'Mid',
  'ROGS.OL': 'Mid',
  'RING.OL': 'Mid',
  'SOAG.OL': 'Mid',
  'SNOR.OL': 'Mid',
  // Små banker
  'HGSB.OL': 'Small',
  'JAREN.OL': 'Small',
  'AURG.OL': 'Small',
  'SKUE.OL': 'Small',
  'MELG.OL': 'Small',
  'SOGN.OL': 'Small',
  'HSPG.OL': 'Small',
  'VVL.OL': 'Small',
  'BIEN.OL': 'Small',
};

interface DailyData {
  date: string;
  close: number;
  volume: number;
  marketCap: number;
  turnover: number;
  turnoverNorm?: number;
}

async function fetchHistoricalData(ticker: string, days: number) {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (days * 24 * 60 * 60);
  
  const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ticker}: ${response.status}`);
  }
  
  const data = await response.json();
  const result = data.chart.result[0];
  
  if (!result || !result.timestamp) {
    return [];
  }
  
  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const volumes = result.indicators.quote[0].volume;
  const sharesOutstanding = SHARES_OUTSTANDING[ticker] || 0;
  
  return timestamps.map((ts: number, i: number) => {
    const close = closes[i];
    const volume = volumes[i] || 0;
    const marketCap = (close * sharesOutstanding) / 1e9; // in billion NOK
    const turnover = marketCap > 0 ? (close * volume) / (marketCap * 1e9) : 0;
    
    return {
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close,
      volume,
      marketCap,
      turnover,
    };
  }).filter((d: DailyData) => d.close !== null && d.volume > 0);
}

function calculateDailyReturn(current: number, previous: number): number {
  return ((current - previous) / previous) * 100;
}

function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(values[i]); // Not enough data, use current value
    } else {
      const window = values.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
      result.push(avg);
    }
  }
  return result;
}

// Calculate 30-day moving average of turnover for normalization
function calculateNormalizedTurnover(data: DailyData[], windowSize: number = 30) {
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      data[i].turnoverNorm = 1; // Not enough data, use neutral value
      continue;
    }
    
    const window = data.slice(i - windowSize + 1, i + 1);
    const avgTurnover = window.reduce((sum, d) => sum + d.turnover, 0) / windowSize;
    
    data[i].turnoverNorm = avgTurnover > 0 ? data[i].turnover / avgTurnover : 1;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting rotation calculation...');
    const days = 365; // Always use 12 months
    
    // Fetch historical data for all banks
    const allDataPromises = BANKS.map(bank => 
      fetchHistoricalData(bank.ticker, days)
        .then(data => ({ ticker: bank.ticker, name: bank.name, data }))
        .catch(err => {
          console.error(`Error fetching ${bank.ticker}:`, err);
          return null;
        })
    );
    
    const allDataResults = await Promise.all(allDataPromises);
    const validData = allDataResults.filter((r): r is { ticker: string; name: string; data: DailyData[] } => 
      r !== null && r.data.length > 1
    );
    
    console.log(`Fetched data for ${validData.length} banks`);
    
    // Calculate normalized turnover for each bank
    for (const bank of validData) {
      calculateNormalizedTurnover(bank.data);
    }
    
    // Categorize banks using fixed categories
    const categorizedBanks = validData.map(({ ticker, name, data }) => {
      const category = BANK_CATEGORIES[ticker] || 'Small';
      console.log(`${name} (${ticker}): ${category}`);
      return { ticker, name, data, category };
    });
    
    console.log(`Categories: Small=${categorizedBanks.filter(b => b.category === 'Small').length}, Mid=${categorizedBanks.filter(b => b.category === 'Mid').length}, Large=${categorizedBanks.filter(b => b.category === 'Large').length}`);
    
    // Get all unique dates
    const allDates = [...new Set(categorizedBanks.flatMap(b => b.data.map(d => d.date)))].sort();
    
    console.log(`Processing ${allDates.length} dates`);
    
    // Calculate rotation metrics for each date
    const rotationTimeSeries = [];
    
    for (let i = 1; i < allDates.length; i++) {
      const date = allDates[i];
      const prevDate = allDates[i - 1];
      
      const categoriesData: Record<string, { returns: number[], turnoverNorms: number[] }> = {
        Small: { returns: [], turnoverNorms: [] },
        Mid: { returns: [], turnoverNorms: [] },
        Large: { returns: [], turnoverNorms: [] }
      };
      
      // Calculate returns and normalized turnovers for each bank
      for (const bank of categorizedBanks) {
        const currentDay = bank.data.find(d => d.date === date);
        const previousDay = bank.data.find(d => d.date === prevDate);
        
        if (currentDay && previousDay && currentDay.turnoverNorm !== undefined) {
          const dailyReturn = calculateDailyReturn(currentDay.close, previousDay.close);
          
          categoriesData[bank.category].returns.push(dailyReturn);
          categoriesData[bank.category].turnoverNorms.push(currentDay.turnoverNorm);
        }
      }
      
      // Calculate average return and turnover norm for each category
      const avgReturns: Record<string, number> = {};
      const avgTurnoverNorms: Record<string, number> = {};
      
      for (const [category, data] of Object.entries(categoriesData)) {
        if (data.returns.length > 0) {
          avgReturns[category] = data.returns.reduce((a, b) => a + b, 0) / data.returns.length;
          avgTurnoverNorms[category] = data.turnoverNorms.reduce((a, b) => a + b, 0) / data.turnoverNorms.length;
        } else {
          avgReturns[category] = 0;
          avgTurnoverNorms[category] = 1;
        }
      }
      
      // Calculate rotation metrics
      const returnRotation = avgReturns['Large'] - avgReturns['Small'];
      const turnoverRotation = avgTurnoverNorms['Large'] - avgTurnoverNorms['Small'];
      
      rotationTimeSeries.push({
        date,
        returnRotation,
        turnoverRotation,
        avgReturns,
        avgTurnoverNorms
      });
    }
    
    // Calculate z-scores for combined rotation
    const returnRotations = rotationTimeSeries.map(r => r.returnRotation);
    const turnoverRotations = rotationTimeSeries.map(r => r.turnoverRotation);
    
    const meanReturnRot = returnRotations.reduce((a, b) => a + b, 0) / returnRotations.length;
    const stdDevReturnRot = calculateStdDev(returnRotations);
    
    const meanTurnoverRot = turnoverRotations.reduce((a, b) => a + b, 0) / turnoverRotations.length;
    const stdDevTurnoverRot = calculateStdDev(turnoverRotations);
    
    // Add combined rotation z-score (0.5 * z(return) + 0.5 * z(turnover))
    const rotationTimeSeriesWithZScore = rotationTimeSeries.map(r => {
      const returnZ = calculateZScore(r.returnRotation, meanReturnRot, stdDevReturnRot);
      const turnoverZ = calculateZScore(r.turnoverRotation, meanTurnoverRot, stdDevTurnoverRot);
      const combinedRotation = 0.5 * returnZ + 0.5 * turnoverZ;
      
      return { ...r, returnZ, turnoverZ, combinedRotation };
    });
    
    // Calculate 10-day moving average (smooth)
    const combinedRotations = rotationTimeSeriesWithZScore.map(r => r.combinedRotation);
    const smoothRotations = calculateMovingAverage(combinedRotations, 10);
    
    // Calculate cumulative rotation
    let cumulative = 0;
    const cumulativeRotations = combinedRotations.map(val => {
      cumulative += val;
      return cumulative;
    });
    
    // Calculate percentiles and std dev for thresholds
    const p90 = calculatePercentile(cumulativeRotations, 90);
    const p10 = calculatePercentile(cumulativeRotations, 10);
    const meanCumulative = cumulativeRotations.reduce((a, b) => a + b, 0) / cumulativeRotations.length;
    const stdDevCumulative = calculateStdDev(cumulativeRotations);
    const upperStdDev = meanCumulative + stdDevCumulative;
    const lowerStdDev = meanCumulative - stdDevCumulative;
    
    // Add all new metrics to time series
    const enrichedTimeSeries = rotationTimeSeriesWithZScore.map((r, i) => ({
      ...r,
      smoothRotation: smoothRotations[i],
      cumulativeRotation: cumulativeRotations[i],
    }));
    
    // Get current metrics (last date)
    const currentMetrics = {
      ...enrichedTimeSeries[enrichedTimeSeries.length - 1],
      interpretation: enrichedTimeSeries[enrichedTimeSeries.length - 1].combinedRotation > 0 ? 'Risk-off' : 'Risk-on'
    };
    
    const thresholds = {
      p90,
      p10,
      upperStdDev,
      lowerStdDev,
      meanCumulative,
    };
    
    // Get bank categorization for UI
    const banksByCategory = {
      Small: categorizedBanks.filter(b => b.category === 'Small').map(b => ({ name: b.name, ticker: b.ticker })),
      Mid: categorizedBanks.filter(b => b.category === 'Mid').map(b => ({ name: b.name, ticker: b.ticker })),
      Large: categorizedBanks.filter(b => b.category === 'Large').map(b => ({ name: b.name, ticker: b.ticker }))
    };
    
    console.log('Rotation calculation completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        rotationTimeSeries: enrichedTimeSeries,
        currentMetrics,
        banksByCategory,
        thresholds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error calculating rotation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});