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
  return?: number;
  marketCap?: number;
  turnover?: number;
  turnoverNorm?: number;
}

interface BankData {
  ticker: string;
  name: string;
  category: string;
  data: DailyData[];
}

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (days * 24 * 60 * 60);
  
  const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  
  console.log(`Fetching data for ${ticker}`);
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${ticker}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result || !result.timestamp) {
      return [];
    }
    
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const volumes = result.indicators.quote[0].volume;
    
    const dailyData: DailyData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      const volume = volumes[i] || 0;
      
      if (close != null && !isNaN(close) && close > 0) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        dailyData.push({ date, close, volume });
      }
    }
    
    return dailyData.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return [];
  }
}

function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateZScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = calculateStdDev(values);
  if (std === 0) return values.map(() => 0);
  return values.map(v => (v - mean) / std);
}

function winsorize(values: number[], lower: number = 0.01, upper: number = 0.99): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const lowerIdx = Math.floor(values.length * lower);
  const upperIdx = Math.floor(values.length * upper);
  const lowerBound = sorted[lowerIdx];
  const upperBound = sorted[upperIdx];
  return values.map(v => Math.max(lowerBound, Math.min(upperBound, v)));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { days = 365 } = await req.json();
    console.log(`Calculating Alpha Engine with ${days} days`);

    // Fetch data for all banks
    const allData: BankData[] = await Promise.all(
      BANKS.map(async (bank) => {
        const data = await fetchHistoricalData(bank.ticker, days + 60); // Extra for calculations
        return {
          ticker: bank.ticker,
          name: bank.name,
          category: BANK_CATEGORIES[bank.ticker],
          data,
        };
      })
    );

    const validBanks = allData.filter(b => b.data.length > 30);
    if (validBanks.length === 0) {
      throw new Error('No valid bank data');
    }

    // Calculate returns, market cap, turnover
    for (const bank of validBanks) {
      const shares = SHARES_OUTSTANDING[bank.ticker] || 1;
      for (let i = 0; i < bank.data.length; i++) {
        const d = bank.data[i];
        d.marketCap = d.close * shares;
        d.turnover = (d.volume * d.close) / d.marketCap;
        
        if (i > 0) {
          d.return = d.close / bank.data[i - 1].close - 1;
        }
      }

      // Calculate normalized turnover (30-day rolling average)
      for (let i = 30; i < bank.data.length; i++) {
        const last30 = bank.data.slice(i - 30, i).map(d => d.turnover || 0);
        const avg = last30.reduce((a, b) => a + b, 0) / last30.length;
        bank.data[i].turnoverNorm = avg > 0 ? (bank.data[i].turnover || 0) / avg : 1;
      }
    }

    // Find common dates (starting from day 60 to have enough history)
    const dateSet = new Set(validBanks[0].data.slice(60).map(d => d.date));
    for (const bank of validBanks.slice(1)) {
      const bankDates = new Set(bank.data.slice(60).map(d => d.date));
      dateSet.forEach(d => { if (!bankDates.has(d)) dateSet.delete(d); });
    }
    const commonDates = Array.from(dateSet).sort();

    console.log(`Common dates: ${commonDates.length}`);

    // Calculate factors per date
    const results: any[] = [];

    for (const date of commonDates) {
      const dayData = validBanks.map(bank => {
        const idx = bank.data.findIndex(d => d.date === date);
        if (idx === -1) return null;
        return {
          ticker: bank.ticker,
          name: bank.name,
          category: bank.category,
          return: bank.data[idx].return || 0,
          absReturn: Math.abs(bank.data[idx].return || 0),
          turnover: bank.data[idx].turnover || 0,
          turnoverNorm: bank.data[idx].turnoverNorm || 1,
          last20Returns: bank.data.slice(Math.max(0, idx - 20), idx).map(d => d.return || 0),
        };
      }).filter(d => d !== null);

      if (dayData.length < 10) continue;

      // Sector mean return
      const sectorReturn = dayData.reduce((a, b) => a + b.return, 0) / dayData.length;

      // 1. RMF (Residual Momentum Factor) - calculated per bank with EMA_20
      const rmfValues = dayData.map(d => {
        const residuals = d.last20Returns.map(r => r - sectorReturn);
        if (residuals.length === 0) return 0;
        const ema = calculateEMA(residuals, 20);
        return ema[ema.length - 1] || 0;
      });

      // 2. LAF (Liquidity Asymmetry Factor)
      const lafRaw = dayData.map(d => d.absReturn / Math.max(d.turnover, 1e-9));
      const lafWinsorized = winsorize(lafRaw);
      const sectorMedianLAF = median(lafWinsorized);
      const lafValues = lafWinsorized.map(v => v - sectorMedianLAF);

      // 3. SRF (Size Rotation Factor) - sector level
      const smallBanks = dayData.filter(d => d.category === 'Small');
      const largeBanks = dayData.filter(d => d.category === 'Large');
      const smallReturn = smallBanks.length > 0 ? smallBanks.reduce((a, b) => a + b.return, 0) / smallBanks.length : 0;
      const largeReturn = largeBanks.length > 0 ? largeBanks.reduce((a, b) => a + b.return, 0) / largeBanks.length : 0;
      const smallTurnover = smallBanks.length > 0 ? smallBanks.reduce((a, b) => a + b.turnoverNorm, 0) / smallBanks.length : 1;
      const largeTurnover = largeBanks.length > 0 ? largeBanks.reduce((a, b) => a + b.turnoverNorm, 0) / largeBanks.length : 1;
      const srf = (smallReturn - largeReturn) + (smallTurnover - largeTurnover);

      // 4. VSF (Volatility Spread Factor) - sector level (20-day rolling volatility)
      const smallVol = smallBanks.length > 0 ? calculateStdDev(smallBanks.flatMap(b => b.last20Returns)) : 0;
      const largeVol = largeBanks.length > 0 ? calculateStdDev(largeBanks.flatMap(b => b.last20Returns)) : 0;
      const vsf = largeVol > 0 ? (smallVol / largeVol) - 1 : 0;

      // Cross-sectional z-scores for RMF and LAF
      const zRMF = calculateZScore(rmfValues);
      const zLAF = calculateZScore(lafValues);

      // Bank Alpha Score (BAS)
      const basValues = dayData.map((d, i) => 
        0.45 * zRMF[i] - 0.25 * zLAF[i] + 0.20 * srf + 0.10 * vsf
      );

      dayData.forEach((d, i) => {
        results.push({
          date,
          ticker: d.ticker,
          name: d.name,
          category: d.category,
          rmf: rmfValues[i],
          zRMF: zRMF[i],
          laf: lafValues[i],
          zLAF: zLAF[i],
          srf,
          vsf,
          bas: basValues[i],
          return: d.return,
          turnover: d.turnover,
          turnoverNorm: d.turnoverNorm,
        });
      });
    }

    // Calculate BAS_EMA (10-day EMA of BAS per bank)
    const banksMap = new Map<string, any[]>();
    for (const r of results) {
      if (!banksMap.has(r.ticker)) banksMap.set(r.ticker, []);
      banksMap.get(r.ticker)!.push(r);
    }

    for (const [ticker, records] of banksMap.entries()) {
      const basValues = records.map(r => r.bas);
      const basEMA = calculateEMA(basValues, 10);
      records.forEach((r, i) => {
        r.basEMA = basEMA[i];
      });
    }

    // Get latest date data
    const latestDate = commonDates[commonDates.length - 1];
    const latestData = results.filter(r => r.date === latestDate);
    const sortedByBAS = [...latestData].sort((a, b) => b.basEMA - a.basEMA);

    // Generate sparklines (last 20 days)
    const last20Dates = commonDates.slice(-20);
    const sparklines = new Map<string, number[]>();
    for (const ticker of Array.from(banksMap.keys())) {
      const last20 = results.filter(r => r.ticker === ticker && last20Dates.includes(r.date));
      sparklines.set(ticker, last20.map(r => r.basEMA));
    }

    const response = {
      success: true,
      date: latestDate,
      topAlpha: sortedByBAS[0],
      bottomAlpha: sortedByBAS[sortedByBAS.length - 1],
      sectorSRF: latestData[0]?.srf || 0,
      top5: sortedByBAS.slice(0, 5).map(d => ({
        ...d,
        sparkline: sparklines.get(d.ticker) || [],
      })),
      bottom5: sortedByBAS.slice(-5).reverse().map(d => ({
        ...d,
        sparkline: sparklines.get(d.ticker) || [],
      })),
      heatmapData: latestData,
      timeSeries: results,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
