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
  'DNB.OL': 1600000000, // Estimated for DNB
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

interface DailyData {
  date: string;
  close: number;
  volume: number;
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
  
  return timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    close: closes[i],
    volume: volumes[i] || 0,
  })).filter((d: DailyData) => d.close !== null && d.volume > 0);
}

function calculateMarketCap(close: number, sharesOutstanding: number): number {
  return (close * sharesOutstanding) / 1e9; // in billion NOK
}

function categorizeBankBySize(marketCap: number): 'Small' | 'Mid' | 'Large' {
  if (marketCap < 10) return 'Small';
  if (marketCap < 50) return 'Mid';
  return 'Large';
}

function calculateDailyReturn(current: number, previous: number): number {
  return ((current - previous) / previous) * 100;
}

function calculateTurnover(close: number, volume: number, marketCap: number): number {
  if (marketCap === 0) return 0;
  return (close * volume) / (marketCap * 1e9); // marketCap back to actual value
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
    
    // Categorize banks by market cap (using latest data)
    const categorizedBanks = validData.map(({ ticker, name, data }) => {
      const latestData = data[data.length - 1];
      const sharesOutstanding = SHARES_OUTSTANDING[ticker] || 0;
      const marketCap = calculateMarketCap(latestData.close, sharesOutstanding);
      const category = categorizeBankBySize(marketCap);
      
      console.log(`${name} (${ticker}): Close=${latestData.close.toFixed(2)}, Shares=${(sharesOutstanding/1e6).toFixed(1)}M, MarketCap=${marketCap.toFixed(2)} mrd NOK → ${category}`);
      
      return { ticker, name, data, category, marketCap };
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
      
      const categoriesData: Record<string, { returns: number[], turnovers: number[] }> = {
        Small: { returns: [], turnovers: [] },
        Mid: { returns: [], turnovers: [] },
        Large: { returns: [], turnovers: [] }
      };
      
      // Calculate returns and turnovers for each bank
      for (const bank of categorizedBanks) {
        const currentDay = bank.data.find(d => d.date === date);
        const previousDay = bank.data.find(d => d.date === prevDate);
        
        if (currentDay && previousDay) {
          const dailyReturn = calculateDailyReturn(currentDay.close, previousDay.close);
          const turnover = calculateTurnover(currentDay.close, currentDay.volume, bank.marketCap);
          
          categoriesData[bank.category].returns.push(dailyReturn);
          categoriesData[bank.category].turnovers.push(turnover);
        }
      }
      
      // Calculate average return and turnover for each category
      const avgReturns: Record<string, number> = {};
      const avgTurnovers: Record<string, number> = {};
      
      for (const [category, data] of Object.entries(categoriesData)) {
        if (data.returns.length > 0) {
          avgReturns[category] = data.returns.reduce((a, b) => a + b, 0) / data.returns.length;
          avgTurnovers[category] = data.turnovers.reduce((a, b) => a + b, 0) / data.turnovers.length;
        } else {
          avgReturns[category] = 0;
          avgTurnovers[category] = 0;
        }
      }
      
      // Calculate rotation metrics
      const returnRotation = avgReturns['Large'] - avgReturns['Small'];
      const turnoverRotation = avgTurnovers['Large'] - avgTurnovers['Small'];
      
      rotationTimeSeries.push({
        date,
        returnRotation,
        turnoverRotation,
        avgReturns,
        avgTurnovers
      });
    }
    
    // Calculate z-scores for combined rotation
    const returnRotations = rotationTimeSeries.map(r => r.returnRotation);
    const turnoverRotations = rotationTimeSeries.map(r => r.turnoverRotation);
    
    const meanReturnRot = returnRotations.reduce((a, b) => a + b, 0) / returnRotations.length;
    const stdDevReturnRot = calculateStdDev(returnRotations);
    
    const meanTurnoverRot = turnoverRotations.reduce((a, b) => a + b, 0) / turnoverRotations.length;
    const stdDevTurnoverRot = calculateStdDev(turnoverRotations);
    
    // Add combined rotation z-score
    const rotationTimeSeriesWithZScore = rotationTimeSeries.map(r => {
      const returnZ = calculateZScore(r.returnRotation, meanReturnRot, stdDevReturnRot);
      const turnoverZ = calculateZScore(r.turnoverRotation, meanTurnoverRot, stdDevTurnoverRot);
      const combinedRotation = returnZ + turnoverZ;
      
      return { ...r, combinedRotation };
    });
    
    // Get current metrics (last date)
    const currentMetrics = rotationTimeSeriesWithZScore[rotationTimeSeriesWithZScore.length - 1];
    
    // Get bank categorization for UI
    const banksByCategory = {
      Small: categorizedBanks.filter(b => b.category === 'Small').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap })),
      Mid: categorizedBanks.filter(b => b.category === 'Mid').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap })),
      Large: categorizedBanks.filter(b => b.category === 'Large').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap }))
    };
    
    console.log('Rotation calculation completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        rotationTimeSeries: rotationTimeSeriesWithZScore,
        currentMetrics,
        banksByCategory
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
