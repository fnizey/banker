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

const BANK_CATEGORIES: Record<string, 'Small' | 'Mid' | 'Large'> = {
  'DNB.OL': 'Large',
  'SB1NO.OL': 'Large',
  'SBNOR.OL': 'Large',
  'MING.OL': 'Large',
  'SPOL.OL': 'Large',
  'NONG.OL': 'Large',
  'MORG.OL': 'Large',
  'SPOG.OL': 'Mid',
  'HELG.OL': 'Mid',
  'ROGS.OL': 'Mid',
  'RING.OL': 'Mid',
  'SOAG.OL': 'Mid',
  'SNOR.OL': 'Mid',
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
}

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days - 30); // Extra days for calculations

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

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting VDI calculation...');
    
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
      const category = BANK_CATEGORIES[bank.ticker];
      
      return {
        ticker: bank.ticker,
        name: bank.name,
        category,
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

    // Calculate VDI for each date
    const vdiTimeSeries = allDates.map(date => {
      const smallBanks = bankMetrics.filter(b => b.category === 'Small' && b.data.find(d => d.date === date));
      const largeBanks = bankMetrics.filter(b => b.category === 'Large' && b.data.find(d => d.date === date));

      if (smallBanks.length === 0 || largeBanks.length === 0) return null;

      const smallReturns = smallBanks.map(b => b.data.find(d => d.date === date)?.return || 0);
      const largeReturns = largeBanks.map(b => b.data.find(d => d.date === date)?.return || 0);
      
      const smallTurnover = smallBanks.map(b => b.data.find(d => d.date === date)?.normalizedTurnover || 0);
      const largeTurnover = largeBanks.map(b => b.data.find(d => d.date === date)?.normalizedTurnover || 0);

      const volatilitySmall = calculateStdDev(smallReturns);
      const volatilityLarge = calculateStdDev(largeReturns);
      
      const avgTurnoverSmall = smallTurnover.reduce((a, b) => a + b, 0) / smallTurnover.length;
      const avgTurnoverLarge = largeTurnover.reduce((a, b) => a + b, 0) / largeTurnover.length;

      if (volatilityLarge === 0 || avgTurnoverSmall === 0 || avgTurnoverLarge === 0) return null;

      const vdi = (volatilitySmall / volatilityLarge) / (avgTurnoverSmall / avgTurnoverLarge);

      return {
        date,
        vdi,
        volatilityRatio: volatilitySmall / volatilityLarge,
        turnoverRatio: avgTurnoverSmall / avgTurnoverLarge,
      };
    }).filter(d => d !== null);

    const currentVDI = vdiTimeSeries[vdiTimeSeries.length - 1];

    console.log('VDI calculation completed successfully');

    return new Response(
      JSON.stringify({
        vdiTimeSeries: vdiTimeSeries.slice(-days),
        currentVDI: currentVDI || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in VDI calculation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
