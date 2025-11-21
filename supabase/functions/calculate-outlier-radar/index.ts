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

function calculateZScore(value: number, values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = calculateStdDev(values);
  return std > 0 ? (value - mean) / std : 0;
}

// Simple OLS regression: y = a + b*x
function simpleOLS(x: number[], y: number[]): { alpha: number; beta: number; residuals: number[] } {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) ** 2;
  }
  
  const beta = den > 0 ? num / den : 0;
  const alpha = meanY - beta * meanX;
  const residuals = y.map((yi, i) => yi - (alpha + beta * x[i]));
  
  return { alpha, beta, residuals };
}

// Multiple regression with dummy variables - proper implementation
function multipleOLS(y: number[], X: number[][]): { coefficients: number[]; residuals: number[]; rSquared: number } {
  const n = y.length;
  const k = X[0].length; // number of predictors
  
  // Build design matrix with intercept
  const designMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    designMatrix.push([1, ...X[i]]); // Add intercept column
  }
  
  // Simple matrix multiplication for X'X and X'y
  const XtX: number[][] = [];
  const Xty: number[] = [];
  
  for (let i = 0; i <= k; i++) {
    XtX[i] = [];
    Xty[i] = 0;
    for (let j = 0; j <= k; j++) {
      let sum = 0;
      for (let row = 0; row < n; row++) {
        sum += designMatrix[row][i] * designMatrix[row][j];
      }
      XtX[i][j] = sum;
    }
    for (let row = 0; row < n; row++) {
      Xty[i] += designMatrix[row][i] * y[row];
    }
  }
  
  // Solve using Gaussian elimination (simple implementation)
  const coefficients: number[] = [];
  try {
    // Augment matrix
    for (let i = 0; i <= k; i++) {
      XtX[i].push(Xty[i]);
    }
    
    // Forward elimination
    for (let i = 0; i <= k; i++) {
      let maxRow = i;
      for (let j = i + 1; j <= k; j++) {
        if (Math.abs(XtX[j][i]) > Math.abs(XtX[maxRow][i])) {
          maxRow = j;
        }
      }
      [XtX[i], XtX[maxRow]] = [XtX[maxRow], XtX[i]];
      
      if (Math.abs(XtX[i][i]) < 1e-10) continue;
      
      for (let j = i + 1; j <= k; j++) {
        const factor = XtX[j][i] / XtX[i][i];
        for (let col = i; col <= k + 1; col++) {
          XtX[j][col] -= factor * XtX[i][col];
        }
      }
    }
    
    // Back substitution
    for (let i = k; i >= 0; i--) {
      let sum = XtX[i][k + 1];
      for (let j = i + 1; j <= k; j++) {
        sum -= XtX[i][j] * coefficients[j];
      }
      coefficients[i] = Math.abs(XtX[i][i]) > 1e-10 ? sum / XtX[i][i] : 0;
    }
  } catch {
    // Fallback to simple OLS if matrix is singular
    const sectorReturns = X.map(row => row[0]);
    const { alpha, beta } = simpleOLS(sectorReturns, y);
    coefficients.push(alpha, beta);
    for (let i = 2; i <= k; i++) coefficients.push(0);
  }
  
  // Calculate fitted values and residuals
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    let fitted = coefficients[0];
    for (let j = 0; j < k; j++) {
      fitted += coefficients[j + 1] * X[i][j];
    }
    residuals.push(y[i] - fitted);
  }
  
  // Calculate R²
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((a, yi) => a + (yi - meanY) ** 2, 0);
  const ssRes = residuals.reduce((a, r) => a + r ** 2, 0);
  const rSquared = ssTot > 1e-10 ? Math.max(0, Math.min(1, 1 - (ssRes / ssTot))) : 0;
  
  return { coefficients, residuals, rSquared };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { days = 90 } = await req.json();
    console.log(`Calculating Outlier Radar with ${days} days`);

    // Fetch data
    const allData = await Promise.all(
      BANKS.map(async (bank) => {
        const data = await fetchHistoricalData(bank.ticker, days + 60);
        return {
          ticker: bank.ticker,
          name: bank.name,
          category: BANK_CATEGORIES[bank.ticker],
          data,
        };
      })
    );

    const validBanks = allData.filter(b => b.data.length > 30);

    // Calculate returns, turnover
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
    const rSquaredSeries: { date: string; rSquared: number }[] = [];

    // Daily cross-sectional regression
    for (const date of commonDates) {
      const dayData = validBanks.map(bank => {
        const idx = bank.data.findIndex(d => d.date === date);
        if (idx === -1) return null;
        return {
          ticker: bank.ticker,
          name: bank.name,
          category: bank.category,
          return: bank.data[idx].return || 0,
          turnoverNorm: bank.data[idx].turnoverNorm || 1,
          turnover: bank.data[idx].turnover || 0,
        };
      }).filter(d => d !== null);

      if (dayData.length < 10) continue;

      const sectorReturn = dayData.reduce((a, b) => a + b.return, 0) / dayData.length;
      
      // Run OLS: r_i = alpha + beta * r_sector + gamma * dummies + delta * turnover + epsilon
      const y = dayData.map(d => d.return);
      const X = dayData.map(d => [sectorReturn, d.category === 'Small' ? 1 : 0, d.category === 'Mid' ? 1 : 0, d.turnoverNorm]);
      
      const { residuals, rSquared } = multipleOLS(y, X);
      
      rSquaredSeries.push({ date, rSquared });

      dayData.forEach((d, i) => {
        results.push({
          date,
          ticker: d.ticker,
          name: d.name,
          category: d.category,
          return: d.return,
          residual: residuals[i],
          turnover: d.turnover,
          turnoverNorm: d.turnoverNorm,
        });
      });
    }

    // Calculate zRES (30-day rolling z-score of residuals)
    const banksMap = new Map<string, any[]>();
    for (const r of results) {
      if (!banksMap.has(r.ticker)) banksMap.set(r.ticker, []);
      banksMap.get(r.ticker)!.push(r);
    }

    for (const [ticker, records] of banksMap.entries()) {
      for (let i = 30; i < records.length; i++) {
        const last30Residuals = records.slice(i - 30, i).map(r => r.residual);
        records[i].zRES = calculateZScore(records[i].residual, last30Residuals);
      }

      // SRES (10-day EMA of zRES)
      const zRESValues = records.map(r => r.zRES || 0);
      const sresEMA = calculateEMA(zRESValues, 10);
      records.forEach((r, i) => {
        r.sres = sresEMA[i];
      });

      // API (Anomaly Persistence Index) - % of days with |zRES| > 2 in last 60 days
      for (let i = 60; i < records.length; i++) {
        const last60 = records.slice(i - 60, i);
        const count = last60.filter(r => Math.abs(r.zRES || 0) > 2).length;
        records[i].api = count / 60;
      }

      // ATS (Abnormal Turnover Score) - z-score of turnover relative to 30-day history
      for (let i = 30; i < records.length; i++) {
        const last30Turnover = records.slice(i - 30, i).map(r => r.turnover);
        records[i].ats = calculateZScore(records[i].turnover, last30Turnover);
      }
    }

    // Get latest data
    const latestDate = commonDates[commonDates.length - 1];
    const latestData = results.filter(r => r.date === latestDate && r.sres != null);

    // Outlier table: top 3 positive SRES, top 3 negative SRES (must have abnormal turnover)
    // First get candidates with ATS >= 1
    const highTurnoverBanks = latestData.filter(d => d.ats >= 1);
    
    // Separate positive and negative SRES
    const positiveCandidates = highTurnoverBanks.filter(d => d.sres > 0).sort((a, b) => b.sres - a.sres);
    const negativeCandidates = highTurnoverBanks.filter(d => d.sres < 0).sort((a, b) => a.sres - b.sres);
    
    // Take top 3 from each (no overlap possible since positive vs negative SRES)
    const positiveOutliers = positiveCandidates.slice(0, 3);
    const negativeOutliers = negativeCandidates.slice(0, 3);

    // Calculate 5-day delta SRES
    for (const d of [...positiveOutliers, ...negativeOutliers]) {
      const bankRecords = banksMap.get(d.ticker) || [];
      const currentIdx = bankRecords.findIndex(r => r.date === latestDate);
      if (currentIdx >= 5) {
        d.deltaSRES5d = d.sres - bankRecords[currentIdx - 5].sres;
      }
    }

    // Heatmap: last 30 days SRES for all banks
    const last30Dates = commonDates.slice(-30);
    const heatmapData = validBanks.map(bank => {
      const records = banksMap.get(bank.ticker) || [];
      const last30 = records.filter(r => last30Dates.includes(r.date));
      const avgSRES = last30.length > 0 ? last30.reduce((a, b) => a + (b.sres || 0), 0) / last30.length : 0;
      return {
        ticker: bank.ticker,
        name: bank.name,
        sresData: last30.map(r => ({ date: r.date, sres: r.sres })),
        avgSRES10d: avgSRES,
      };
    }).sort((a, b) => b.avgSRES10d - a.avgSRES10d);

    // Rolling R² (20-day average)
    const rSquared20d = rSquaredSeries.slice(-20).reduce((a, b) => a + b.rSquared, 0) / Math.min(20, rSquaredSeries.length);

    const response = {
      success: true,
      date: latestDate,
      positiveOutliers,
      negativeOutliers,
      heatmapData,
      scatterData: latestData.map(d => ({
        ticker: d.ticker,
        name: d.name,
        return: d.return,
        turnoverNorm: d.turnoverNorm,
        sres: d.sres,
      })),
      rSquared20d,
      alphaEnvironment: rSquared20d < 0.5 ? 'Favorable' : rSquared20d > 0.8 ? 'Difficult' : 'Neutral',
      timeSeries: results,
      rSquaredSeries,
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
