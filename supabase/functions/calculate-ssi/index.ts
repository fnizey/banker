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
  marketCap: number;
  turnover: number;
  turnoverNorm?: number;
}

interface BankData {
  ticker: string;
  name: string;
  category: 'Small' | 'Mid' | 'Large';
  data: DailyData[];
}

// ============= Data Fetching =============

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
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
    const marketCap = (close * sharesOutstanding) / 1e9;
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

async function fetchAllBankData(days: number): Promise<BankData[]> {
  console.log(`Fetching data for ${BANKS.length} banks...`);
  
  const allDataPromises = BANKS.map(bank => 
    fetchHistoricalData(bank.ticker, days)
      .then(data => ({
        ticker: bank.ticker,
        name: bank.name,
        category: BANK_CATEGORIES[bank.ticker] || 'Small' as 'Small' | 'Mid' | 'Large',
        data
      }))
      .catch(err => {
        console.error(`Error fetching ${bank.ticker}:`, err);
        return null;
      })
  );
  
  const allDataResults = await Promise.all(allDataPromises);
  const validData = allDataResults.filter((r): r is BankData => 
    r !== null && r.data.length > 1
  );
  
  console.log(`Successfully fetched data for ${validData.length} banks`);
  return validData;
}

// ============= Utility Functions =============

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateZScore(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = calculateStdDev(values);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(val => (val - mean) / stdDev);
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const ema = values[i] * k + emaArray[i - 1] * (1 - k);
    emaArray.push(ema);
  }
  
  return emaArray;
}

function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(values[i]);
    } else {
      const window = values.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
      result.push(avg);
    }
  }
  return result;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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

function calculateNormalizedTurnover(bankData: BankData, windowSize: number = 30) {
  for (let i = 0; i < bankData.data.length; i++) {
    if (i < windowSize - 1) {
      bankData.data[i].turnoverNorm = 1;
      continue;
    }
    
    const window = bankData.data.slice(i - windowSize + 1, i + 1);
    const avgTurnover = window.reduce((sum, d) => sum + d.turnover, 0) / windowSize;
    
    bankData.data[i].turnoverNorm = avgTurnover > 0 ? bankData.data[i].turnover / avgTurnover : 1;
  }
}

function calculateDailyReturn(current: number, previous: number): number {
  return ((current - previous) / previous) * 100;
}

// ============= Indicator Calculations =============

function calculateCSD(allBankData: BankData[]): { date: string; dispersion: number }[] {
  console.log('Calculating Cross-Sectional Dispersion...');
  
  // Calculate daily returns for each bank
  const bankReturns = allBankData.map(bank => {
    const returns = [];
    for (let i = 1; i < bank.data.length; i++) {
      returns.push({
        date: bank.data[i].date,
        return: calculateDailyReturn(bank.data[i].close, bank.data[i - 1].close)
      });
    }
    return { ticker: bank.ticker, returns };
  });
  
  // Get all unique dates
  const allDates = [...new Set(bankReturns.flatMap(b => b.returns.map(r => r.date)))].sort();
  
  // Calculate dispersion for each date
  const dispersionTimeSeries = allDates.map(date => {
    const returnsForDate = bankReturns
      .map(b => b.returns.find(r => r.date === date)?.return)
      .filter((ret): ret is number => ret !== undefined && !isNaN(ret));
    
    if (returnsForDate.length < 3) return null;
    
    const dispersion = calculateStdDev(returnsForDate);
    return { date, dispersion };
  }).filter((d): d is { date: string; dispersion: number } => d !== null);
  
  console.log(`CSD: ${dispersionTimeSeries.length} data points`);
  return dispersionTimeSeries;
}

function calculateRotation(allBankData: BankData[]): { date: string; combinedRotation: number }[] {
  console.log('Calculating Kapitalrotasjon...');
  
  // Calculate normalized turnover for each bank
  for (const bank of allBankData) {
    calculateNormalizedTurnover(bank);
  }
  
  // Get all unique dates
  const allDates = [...new Set(allBankData.flatMap(b => b.data.map(d => d.date)))].sort();
  
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
    
    for (const bank of allBankData) {
      const currentDay = bank.data.find(d => d.date === date);
      const previousDay = bank.data.find(d => d.date === prevDate);
      
      if (currentDay && previousDay && currentDay.turnoverNorm !== undefined) {
        const dailyReturn = calculateDailyReturn(currentDay.close, previousDay.close);
        
        categoriesData[bank.category].returns.push(dailyReturn);
        categoriesData[bank.category].turnoverNorms.push(currentDay.turnoverNorm);
      }
    }
    
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
    
    const returnRotation = avgReturns['Large'] - avgReturns['Small'];
    const turnoverRotation = avgTurnoverNorms['Large'] - avgTurnoverNorms['Small'];
    
    rotationTimeSeries.push({ date, returnRotation, turnoverRotation });
  }
  
  // Calculate z-scores and combined rotation
  const returnRotations = rotationTimeSeries.map(r => r.returnRotation);
  const turnoverRotations = rotationTimeSeries.map(r => r.turnoverRotation);
  
  const returnZScores = calculateZScore(returnRotations);
  const turnoverZScores = calculateZScore(turnoverRotations);
  
  const combinedRotationSeries = rotationTimeSeries.map((r, i) => ({
    date: r.date,
    combinedRotation: 0.5 * returnZScores[i] + 0.5 * turnoverZScores[i]
  }));
  
  console.log(`Rotation: ${combinedRotationSeries.length} data points`);
  return combinedRotationSeries;
}

function calculateVDI(allBankData: BankData[]): { date: string; vdi: number }[] {
  console.log('Calculating VDI...');
  
  // Calculate normalized turnover for each bank
  for (const bank of allBankData) {
    calculateNormalizedTurnover(bank);
  }
  
  // Calculate returns for each bank
  const bankMetrics = allBankData.map(bank => {
    const returns = [];
    for (let i = 1; i < bank.data.length; i++) {
      returns.push({
        date: bank.data[i].date,
        return: calculateDailyReturn(bank.data[i].close, bank.data[i - 1].close),
        normalizedTurnover: bank.data[i].turnoverNorm || 0,
      });
    }
    return { ticker: bank.ticker, category: bank.category, returns };
  });
  
  // Get all unique dates
  const allDates = Array.from(new Set(bankMetrics.flatMap(b => b.returns.map(r => r.date)))).sort();
  
  // Calculate VDI for each date
  const vdiTimeSeries = allDates.map(date => {
    const smallBanks = bankMetrics.filter(b => b.category === 'Small' && b.returns.find(r => r.date === date));
    const largeBanks = bankMetrics.filter(b => b.category === 'Large' && b.returns.find(r => r.date === date));
    
    if (smallBanks.length === 0 || largeBanks.length === 0) return null;
    
    const smallReturns = smallBanks.map(b => b.returns.find(r => r.date === date)?.return || 0);
    const largeReturns = largeBanks.map(b => b.returns.find(r => r.date === date)?.return || 0);
    
    const smallTurnover = smallBanks.map(b => b.returns.find(r => r.date === date)?.normalizedTurnover || 0);
    const largeTurnover = largeBanks.map(b => b.returns.find(r => r.date === date)?.normalizedTurnover || 0);
    
    const volatilitySmall = calculateStdDev(smallReturns);
    const volatilityLarge = calculateStdDev(largeReturns);
    
    const avgTurnoverSmall = smallTurnover.reduce((a, b) => a + b, 0) / smallTurnover.length;
    const avgTurnoverLarge = largeTurnover.reduce((a, b) => a + b, 0) / largeTurnover.length;
    
    if (volatilityLarge === 0 || avgTurnoverSmall === 0 || avgTurnoverLarge === 0) return null;
    
    const vdi = (volatilitySmall / volatilityLarge) / (avgTurnoverSmall / avgTurnoverLarge);
    
    return { date, vdi };
  }).filter((d): d is { date: string; vdi: number } => d !== null);
  
  console.log(`VDI: ${vdiTimeSeries.length} data points`);
  return vdiTimeSeries;
}

function calculateLARS(allBankData: BankData[]): { date: string; lars: number }[] {
  console.log('Calculating LARS...');
  
  // Calculate normalized turnover for each bank
  for (const bank of allBankData) {
    calculateNormalizedTurnover(bank);
  }
  
  // Calculate returns for each bank
  const bankMetrics = allBankData.map(bank => {
    const returns = [];
    for (let i = 1; i < bank.data.length; i++) {
      returns.push({
        date: bank.data[i].date,
        return: calculateDailyReturn(bank.data[i].close, bank.data[i - 1].close),
        normalizedTurnover: bank.data[i].turnoverNorm || 0,
      });
    }
    return { ticker: bank.ticker, returns };
  });
  
  // Get all unique dates
  const allDates = Array.from(new Set(bankMetrics.flatMap(b => b.returns.map(r => r.date)))).sort();
  
  // Calculate LARS for each date
  const larsTimeSeries = allDates.map(date => {
    const banksOnDate = bankMetrics.filter(b => b.returns.find(r => r.date === date));
    if (banksOnDate.length < 3) return null;
    
    const returns = banksOnDate.map(b => b.returns.find(r => r.date === date)?.return || 0);
    const turnovers = banksOnDate.map(b => b.returns.find(r => r.date === date)?.normalizedTurnover || 0);
    
    const avgTurnover = turnovers.reduce((a, b) => a + b, 0) / turnovers.length;
    const skewness = calculateSkewness(returns);
    
    const lars = avgTurnover === 0 ? 0 : skewness / avgTurnover;
    
    return { date, lars };
  }).filter((d): d is { date: string; lars: number } => d !== null);
  
  console.log(`LARS: ${larsTimeSeries.length} data points`);
  return larsTimeSeries;
}

function calculatePerformance(allBankData: BankData[]): { date: string; performanceDiff: number }[] {
  console.log('Calculating Relativ Ytelse...');
  
  // Calculate cumulative returns for each bank
  const banksWithCumulativeReturns = allBankData.map(bank => {
    const cumulativeReturns: number[] = [0];
    const dates = [bank.data[0].date];
    
    for (let i = 1; i < bank.data.length; i++) {
      const cumReturn = ((bank.data[i].close - bank.data[0].close) / bank.data[0].close) * 100;
      cumulativeReturns.push(cumReturn);
      dates.push(bank.data[i].date);
    }
    
    return {
      ticker: bank.ticker,
      category: bank.category,
      dates,
      cumulativeReturns,
    };
  });
  
  // Get all unique dates
  const allDates = [...new Set(banksWithCumulativeReturns.flatMap(b => b.dates))].sort();
  
  // Calculate performance difference for each date
  const performanceTimeSeries = allDates.map(date => {
    const categoriesData: Record<string, number[]> = {
      Small: [],
      Mid: [],
      Large: []
    };
    
    for (const bank of banksWithCumulativeReturns) {
      const dateIndex = bank.dates.indexOf(date);
      if (dateIndex !== -1) {
        categoriesData[bank.category].push(bank.cumulativeReturns[dateIndex]);
      }
    }
    
    const avgReturns: Record<string, number> = {};
    for (const [category, returns] of Object.entries(categoriesData)) {
      if (returns.length > 0) {
        avgReturns[category] = returns.reduce((a, b) => a + b, 0) / returns.length;
      } else {
        avgReturns[category] = 0;
      }
    }
    
    const performanceDiff = avgReturns['Large'] - avgReturns['Small'];
    return { date, performanceDiff };
  });
  
  console.log(`Performance: ${performanceTimeSeries.length} data points`);
  return performanceTimeSeries;
}

function calculateSMFI(
  rotationSeries: { date: string; combinedRotation: number }[],
  vdiSeries: { date: string; vdi: number }[],
  larsSeries: { date: string; lars: number }[]
): { date: string; smfi: number }[] {
  console.log('Calculating SMFI...');
  
  // Find common dates
  const rotationDates = new Set(rotationSeries.map(d => d.date));
  const vdiDates = new Set(vdiSeries.map(d => d.date));
  const larsDates = new Set(larsSeries.map(d => d.date));
  
  const commonDates = Array.from(rotationDates)
    .filter(date => vdiDates.has(date) && larsDates.has(date))
    .sort();
  
  if (commonDates.length === 0) {
    console.warn('No common dates for SMFI calculation');
    return [];
  }
  
  // Calculate cumulative rotation
  let cumulative = 0;
  const cumulativeRotations = commonDates.map(date => {
    const rotation = rotationSeries.find(d => d.date === date)?.combinedRotation || 0;
    cumulative += rotation;
    return cumulative;
  });
  
  // Extract values for z-score calculation
  const vdiValues = commonDates.map(date => vdiSeries.find(d => d.date === date)!.vdi);
  const larsValues = commonDates.map(date => larsSeries.find(d => d.date === date)!.lars);
  
  // Calculate z-scores
  const cumulativeRotationZScores = calculateZScore(cumulativeRotations);
  const vdiZScores = calculateZScore(vdiValues);
  const larsZScores = calculateZScore(larsValues);
  
  // Calculate SMFI: z(CumulativeRotation) + z(VDI) - z(LARS)
  const smfiTimeSeries = commonDates.map((date, i) => {
    const smfi = cumulativeRotationZScores[i] + vdiZScores[i] - larsZScores[i];
    return { date, smfi };
  });
  
  console.log(`SMFI: ${smfiTimeSeries.length} data points`);
  return smfiTimeSeries;
}

// ============= Main SSI Calculation =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting SSI calculation...');
    const { days = 90 } = await req.json();
    
    // 1. Fetch all bank data once
    const allBankData = await fetchAllBankData(days + 150); // Extra days for moving averages
    
    if (allBankData.length === 0) {
      throw new Error('No bank data available');
    }
    
    // 2. Calculate all indicators
    const csdSeries = calculateCSD(allBankData);
    const rotationSeries = calculateRotation(allBankData);
    const vdiSeries = calculateVDI(allBankData);
    const larsSeries = calculateLARS(allBankData);
    const performanceSeries = calculatePerformance(allBankData);
    const smfiSeries = calculateSMFI(rotationSeries, vdiSeries, larsSeries);
    
    console.log('All indicators calculated, combining into SSI...');
    
    // 3. Find common dates across all indicators
    const csdDates = new Set(csdSeries.map(d => d.date));
    const rotationDates = new Set(rotationSeries.map(d => d.date));
    const vdiDates = new Set(vdiSeries.map(d => d.date));
    const larsDates = new Set(larsSeries.map(d => d.date));
    const performanceDates = new Set(performanceSeries.map(d => d.date));
    const smfiDates = new Set(smfiSeries.map(d => d.date));
    
    const commonDates = Array.from(csdDates)
      .filter(date => 
        rotationDates.has(date) && 
        vdiDates.has(date) && 
        larsDates.has(date) && 
        performanceDates.has(date) &&
        smfiDates.has(date)
      )
      .sort();
    
    console.log(`Found ${commonDates.length} common dates`);
    
    if (commonDates.length === 0) {
      throw new Error('No common dates found across all indicators');
    }
    
    // 4. Extract values for common dates
    const csdValues = commonDates.map(date => csdSeries.find(d => d.date === date)!.dispersion);
    const rotationValues = commonDates.map(date => rotationSeries.find(d => d.date === date)!.combinedRotation);
    const vdiValues = commonDates.map(date => vdiSeries.find(d => d.date === date)!.vdi);
    const larsValues = commonDates.map(date => larsSeries.find(d => d.date === date)!.lars);
    const performanceValues = commonDates.map(date => performanceSeries.find(d => d.date === date)!.performanceDiff);
    const smfiValues = commonDates.map(date => smfiSeries.find(d => d.date === date)!.smfi);
    
    // 5. Calculate z-scores for each component
    const csdZScores = calculateZScore(csdValues);
    const rotationZScores = calculateZScore(rotationValues);
    const vdiZScores = calculateZScore(vdiValues);
    const larsZScores = calculateZScore(larsValues);
    const performanceZScores = calculateZScore(performanceValues);
    const smfiZScores = calculateZScore(smfiValues);
    
    // 6. Calculate raw SSI (equal weighted combination)
    // Invert signs: rotation, lars, and performance are inverted
    const rawSSI = commonDates.map((_, i) => {
      return (
        csdZScores[i] +        // Higher CSD = risk-off (keep positive)
        (-rotationZScores[i]) + // Higher rotation = risk-off, but we invert to match convention
        vdiZScores[i] +        // Higher VDI = risk-off (keep positive)
        (-larsZScores[i]) +    // Higher LARS = risk-on (invert)
        smfiZScores[i] +       // Higher SMFI = risk-off (keep positive)
        (-performanceZScores[i]) // Higher perf diff = risk-off, invert
      ) / 6; // Average of 6 components
    });
    
    // 7. Calculate 10-day EMA of raw SSI
    const ssiEMA = calculateEMA(rawSSI, 10);
    
    // 8. Calculate detrended SSI and cumulative SSI
    const rollingMean = calculateMovingAverage(rawSSI, 120);
    const detrendedSSI = rawSSI.map((val, i) => val - rollingMean[i]);
    
    let cumulativeSum = 0;
    const ssiCumulative = detrendedSSI.map(val => {
      cumulativeSum += val;
      return cumulativeSum;
    });
    
    // 9. Build time series with all components
    const ssiTimeSeries = commonDates.map((date, i) => ({
      date,
      ssiRaw: rawSSI[i],
      ssiEMA: ssiEMA[i],
      ssiCumulative: ssiCumulative[i],
      components: {
        csd: csdZScores[i],
        rotation: rotationZScores[i],
        vdi: vdiZScores[i],
        lars: larsZScores[i],
        smfi: smfiZScores[i],
        relativePerformance: performanceZScores[i],
      },
    }));
    
    // 10. Calculate statistics
    const emaValues = ssiEMA.slice(-days);
    const cumulativeValues = ssiCumulative.slice(-days);
    
    const emaMean = emaValues.reduce((a, b) => a + b, 0) / emaValues.length;
    const emaStdDev = calculateStdDev(emaValues);
    
    const cumulativeMean = cumulativeValues.reduce((a, b) => a + b, 0) / cumulativeValues.length;
    const cumulativeStdDev = calculateStdDev(cumulativeValues);
    
    const emaStats = {
      mean: emaMean,
      stdDev: emaStdDev,
      upperBand: emaMean + emaStdDev,
      lowerBand: emaMean - emaStdDev,
    };
    
    const cumulativeStats = {
      mean: cumulativeMean,
      stdDev: cumulativeStdDev,
      upperBand: cumulativeMean + cumulativeStdDev,
      lowerBand: cumulativeMean - cumulativeStdDev,
      p90: calculatePercentile(cumulativeValues, 90),
      p10: calculatePercentile(cumulativeValues, 10),
    };
    
    // 11. Get current values
    const currentSSI = ssiTimeSeries[ssiTimeSeries.length - 1];
    
    // Calculate 5-day change
    const fiveDaysAgoIndex = Math.max(0, ssiTimeSeries.length - 6);
    const fiveDayChange = currentSSI.ssiEMA - ssiTimeSeries[fiveDaysAgoIndex].ssiEMA;
    
    // Determine sentiment
    let sentiment = 'Nøytral';
    if (currentSSI.ssiEMA > 0.7) {
      sentiment = 'Defensiv / Risk-off';
    } else if (currentSSI.ssiEMA < -0.7) {
      sentiment = 'Risk-on';
    }
    
    console.log('SSI calculation completed successfully');
    
    return new Response(
      JSON.stringify({
        ssiTimeSeries: ssiTimeSeries.slice(-days),
        currentSSI,
        fiveDayChange,
        sentiment,
        emaStatistics: emaStats,
        cumulativeStatistics: cumulativeStats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error calculating SSI:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
