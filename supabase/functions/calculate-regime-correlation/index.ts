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

interface DailyData {
  date: string;
  close: number;
  volume: number;
  return?: number;
  marketCap?: number;
  turnover?: number;
  turnoverNorm?: number;
}

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (days * 24 * 60 * 60);

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const data: DailyData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 6) {
        const close = parseFloat(cols[4]);
        const volume = parseFloat(cols[6]);
        if (!isNaN(close) && !isNaN(volume) && close > 0) {
          data.push({ date: cols[0], close, volume });
        }
      }
    }
    
    return data.sort((a, b) => a.date.localeCompare(b.date));
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

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  return denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
}

// Simple PCA: calculate eigenvalues of covariance matrix (approximation)
function calculatePCA(returns: number[][]): { lambda1: number; lambda2: number; cc: number } {
  const n = returns.length; // number of stocks
  const t = returns[0].length; // number of time periods
  
  if (n < 2 || t < 2) return { lambda1: 0, lambda2: 0, cc: 0 };
  
  // Calculate covariance matrix (simplified: just use correlation)
  const correlations: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      correlations.push(calculateCorrelation(returns[i], returns[j]));
    }
  }
  
  // Approximate eigenvalues: λ1 ≈ n * mean(correlations), λ2 ≈ variance of correlations
  const meanCorr = correlations.reduce((a, b) => a + b, 0) / correlations.length;
  const lambda1 = n * meanCorr;
  const varCorr = correlations.reduce((a, c) => a + (c - meanCorr) ** 2, 0) / correlations.length;
  const lambda2 = Math.sqrt(varCorr) * n * 0.2; // rough approximation
  
  const totalVar = n; // normalized
  const cc = lambda1 / totalVar;
  
  return { lambda1, lambda2, cc };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { days = 90 } = await req.json();
    console.log(`Calculating Regime & Correlation with ${days} days`);

    // Fetch data
    const allData = await Promise.all(
      BANKS.map(async (bank) => {
        const data = await fetchHistoricalData(bank.ticker, days + 60);
        return {
          ticker: bank.ticker,
          name: bank.name,
          data,
        };
      })
    );

    const validBanks = allData.filter(b => b.data.length > 30);

    // Calculate returns and turnover
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

      // Normalized turnover
      for (let i = 30; i < bank.data.length; i++) {
        const last30 = bank.data.slice(i - 30, i).map(d => d.turnover || 0);
        const avg = last30.reduce((a, b) => a + b, 0) / last30.length;
        bank.data[i].turnoverNorm = avg > 0 ? (bank.data[i].turnover || 0) / avg : 1;
      }
    }

    // Find common dates
    const dateSet = new Set(validBanks[0].data.slice(60).map(d => d.date));
    for (const bank of validBanks.slice(1)) {
      const bankDates = new Set(bank.data.slice(60).map(d => d.date));
      dateSet.forEach(d => { if (!bankDates.has(d)) dateSet.delete(d); });
    }
    const commonDates = Array.from(dateSet).sort();

    const results: any[] = [];

    // Calculate daily metrics
    for (let i = 60; i < commonDates.length; i++) {
      const date = commonDates[i];
      
      // Get returns for all banks for this date
      const dayReturns = validBanks.map(bank => {
        const idx = bank.data.findIndex(d => d.date === date);
        return idx >= 0 ? bank.data[idx].return || 0 : 0;
      });

      // Get turnover norms
      const dayTurnoverNorms = validBanks.map(bank => {
        const idx = bank.data.findIndex(d => d.date === date);
        return idx >= 0 ? bank.data[idx].turnoverNorm || 1 : 1;
      });

      // Rolling 60-day returns matrix for PCA
      const returnsMatrix: number[][] = [];
      const last60Dates = commonDates.slice(Math.max(0, i - 60), i);
      for (const bank of validBanks) {
        const bankReturns = last60Dates.map(d => {
          const idx = bank.data.findIndex(dd => dd.date === d);
          return idx >= 0 ? bank.data[idx].return || 0 : 0;
        });
        returnsMatrix.push(bankReturns);
      }

      // PCA
      const { lambda1, lambda2, cc } = calculatePCA(returnsMatrix);

      // XCI (Cross-Sectional Correlation Index) - average pairwise correlation over last 20 days
      const last20Dates = commonDates.slice(Math.max(0, i - 20), i);
      const correlations: number[] = [];
      for (let j = 0; j < validBanks.length; j++) {
        for (let k = j + 1; k < validBanks.length; k++) {
          const returns1 = last20Dates.map(d => {
            const idx = validBanks[j].data.findIndex(dd => dd.date === d);
            return idx >= 0 ? validBanks[j].data[idx].return || 0 : 0;
          });
          const returns2 = last20Dates.map(d => {
            const idx = validBanks[k].data.findIndex(dd => dd.date === d);
            return idx >= 0 ? validBanks[k].data[idx].return || 0 : 0;
          });
          correlations.push(calculateCorrelation(returns1, returns2));
        }
      }
      const xci = correlations.length > 0 ? correlations.reduce((a, b) => a + b, 0) / correlations.length : 0;

      // FBI (Liquidity Breadth Index)
      const fbi = dayTurnoverNorms.filter(t => t > 1).length / dayTurnoverNorms.length;

      // SSI_EMA proxy (simplified: use average return as sentiment)
      const avgReturn = dayReturns.reduce((a, b) => a + b, 0) / dayReturns.length;
      
      results.push({
        date,
        cc,
        xci,
        fbi,
        avgReturn,
      });
    }

    // Calculate SSI_EMA (10-day EMA of avgReturn)
    const avgReturns = results.map(r => r.avgReturn);
    const ssiEMA = calculateEMA(avgReturns, 10);
    results.forEach((r, i) => {
      r.ssiEMA = ssiEMA[i];
    });

    // Regime labels
    for (const r of results) {
      if (r.ssiEMA < -0.007) r.regime = 'Risk-on';
      else if (r.ssiEMA > 0.007) r.regime = 'Risk-off';
      else r.regime = 'Neutral';
    }

    // Latest values
    const latestDate = commonDates[commonDates.length - 1];
    const latest = results[results.length - 1];

    // Calculate 30-day averages for FBI
    const last30FBI = results.slice(-30).map(r => r.fbi);
    const avgFBI30d = last30FBI.reduce((a, b) => a + b, 0) / last30FBI.length;

    const response = {
      success: true,
      date: latestDate,
      currentRegime: latest?.regime || 'Neutral',
      currentCC: latest?.cc || 0,
      currentXCI: latest?.xci || 0,
      currentFBI: latest?.fbi || 0,
      avgFBI30d,
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
