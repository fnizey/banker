import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BacktestRequest {
  signalType: string;
  days?: number;
  threshold?: number;
}

interface BacktestResult {
  signalName: string;
  threshold: number;
  stats: {
    sharpe: number;
    avgReturn1d: number;
    avgReturn5d: number;
    avgReturn20d: number;
    winRate1d: number;
    winRate5d: number;
    winRate20d: number;
    maxDrawdown: number;
    numTrades: number;
    avgSignalValue: number;
    medianSignalValue: number;
  };
  forwardReturns: {
    date: string;
    ticker: string;
    signalValue: number;
    return1d: number;
    return5d: number;
    return20d: number;
  }[];
  equityCurve: {
    date: string;
    cumulativeReturn: number;
  }[];
}

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
  'DNB.OL': 1_500_000_000,
  'SB1NO.OL': 75_000_000,
  'SBNOR.OL': 140_000_000,
  'MING.OL': 390_000_000,
  'SPOL.OL': 110_000_000,
  'NONG.OL': 86_000_000,
  'MORG.OL': 35_000_000,
  'SPOG.OL': 50_000_000,
  'HELG.OL': 40_000_000,
  'ROGS.OL': 45_000_000,
  'RING.OL': 33_000_000,
  'SOAG.OL': 82_000_000,
  'SNOR.OL': 28_000_000,
  'HGSB.OL': 25_000_000,
  'JAREN.OL': 18_000_000,
  'AURG.OL': 12_000_000,
  'SKUE.OL': 8_000_000,
  'MELG.OL': 15_000_000,
  'SOGN.OL': 20_000_000,
  'HSPG.OL': 10_000_000,
  'VVL.OL': 22_000_000,
  'BIEN.OL': 16_000_000,
};

interface DailyData {
  date: string;
  close: number;
  volume: number;
}

async function fetchHistoricalData(ticker: string, days: number): Promise<DailyData[]> {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (days * 24 * 60 * 60);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${ticker}`);
  }
  
  const data = await response.json();
  const result = data.chart.result[0];
  const timestamps = result.timestamp;
  const quotes = result.indicators.quote[0];
  
  return timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    close: quotes.close[i],
    volume: quotes.volume[i] || 0
  })).filter((d: DailyData) => d.close && d.volume);
}

function calculateReturns(prices: number[]): number[] {
  return prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
}

function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(NaN);
    } else {
      const sum = values.slice(i - windowSize + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / windowSize);
    }
  }
  return result;
}

function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateNormalizedTurnover(data: DailyData[], sharesOutstanding: number): number[] {
  const turnover = data.map(d => d.volume / sharesOutstanding);
  const ma = calculateMovingAverage(turnover, 20);
  return turnover.map((t, i) => ma[i] ? t / ma[i] : NaN);
}

function calculateSkewness(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const stdDev = calculateStdDev(values);
  const skew = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n;
  return skew;
}

async function calculateSignalValues(
  signalType: string,
  days: number
): Promise<Map<string, { date: string; value: number; ticker: string }[]>> {
  console.log(`Calculating ${signalType} signal values for ${days} days`);
  
  // Fetch data for all banks
  const allData = new Map<string, DailyData[]>();
  for (const bank of BANKS) {
    try {
      const data = await fetchHistoricalData(bank.ticker, days + 30);
      allData.set(bank.ticker, data);
    } catch (error) {
      console.error(`Error fetching data for ${bank.ticker}:`, error);
    }
  }

  const signalValues = new Map<string, { date: string; value: number; ticker: string }[]>();

  if (signalType === 'abnormalVolume') {
    // Calculate abnormal volume z-scores
    for (const [ticker, data] of allData.entries()) {
      const volumes = data.map(d => d.volume);
      const last30 = volumes.slice(-30);
      const mean = last30.reduce((a, b) => a + b, 0) / last30.length;
      const stdDev = calculateStdDev(last30);
      
      const values = data.slice(-days).map((d, i) => {
        const idx = volumes.length - days + i;
        const window = volumes.slice(Math.max(0, idx - 29), idx + 1);
        const windowMean = window.reduce((a, b) => a + b, 0) / window.length;
        const windowStd = calculateStdDev(window);
        const zScore = windowStd > 0 ? (d.volume - windowMean) / windowStd : 0;
        return { date: d.date, value: zScore, ticker };
      });
      
      signalValues.set(ticker, values);
    }
  } else if (signalType === 'lars') {
    // Calculate LARS (cross-sectional turnover skewness)
    const dateMap = new Map<string, { ticker: string; normalizedTurnover: number; return: number }[]>();
    
    for (const [ticker, data] of allData.entries()) {
      const sharesOut = SHARES_OUTSTANDING[ticker] || 50_000_000;
      const normalizedTurnover = calculateNormalizedTurnover(data, sharesOut);
      const returns = calculateReturns(data.map(d => d.close));
      
      data.forEach((d, i) => {
        if (!dateMap.has(d.date)) {
          dateMap.set(d.date, []);
        }
        if (!isNaN(normalizedTurnover[i])) {
          dateMap.get(d.date)!.push({
            ticker,
            normalizedTurnover: normalizedTurnover[i],
            return: returns[i] || 0
          });
        }
      });
    }
    
    // Calculate cross-sectional skewness for each date
    for (const [date, banksData] of dateMap.entries()) {
      if (banksData.length < 5) continue;
      
      const turnovers = banksData.map(b => b.normalizedTurnover);
      const avgTurnover = turnovers.reduce((a, b) => a + b, 0) / turnovers.length;
      const skewness = calculateSkewness(turnovers);
      
      banksData.forEach(b => {
        if (!signalValues.has(b.ticker)) {
          signalValues.set(b.ticker, []);
        }
        // LARS value per bank = normalized turnover percentile rank
        const percentile = turnovers.filter(t => t < b.normalizedTurnover).length / turnovers.length * 100;
        signalValues.get(b.ticker)!.push({ date, value: percentile, ticker: b.ticker });
      });
    }
  } else if (signalType === 'volumeAnomaly') {
    // Simple volume spike detection
    for (const [ticker, data] of allData.entries()) {
      const volumes = data.map(d => d.volume);
      const values = data.slice(-days).map((d, i) => {
        const idx = volumes.length - days + i;
        const window = volumes.slice(Math.max(0, idx - 19), idx);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        const spike = avg > 0 ? ((d.volume - avg) / avg) * 100 : 0;
        return { date: d.date, value: spike, ticker };
      });
      signalValues.set(ticker, values);
    }
  }

  return signalValues;
}

function calculateForwardReturns(
  data: DailyData[],
  currentIdx: number
): { return1d: number; return5d: number; return20d: number } {
  const currentPrice = data[currentIdx].close;
  
  const price1d = currentIdx + 1 < data.length ? data[currentIdx + 1].close : currentPrice;
  const price5d = currentIdx + 5 < data.length ? data[currentIdx + 5].close : currentPrice;
  const price20d = currentIdx + 20 < data.length ? data[currentIdx + 20].close : currentPrice;
  
  return {
    return1d: (price1d - currentPrice) / currentPrice,
    return5d: (price5d - currentPrice) / currentPrice,
    return20d: (price20d - currentPrice) / currentPrice
  };
}

function calculateBacktestStats(
  forwardReturns: { return1d: number; return5d: number; return20d: number; signalValue: number }[]
): BacktestResult['stats'] {
  const returns1d = forwardReturns.map(r => r.return1d);
  const returns5d = forwardReturns.map(r => r.return5d);
  const returns20d = forwardReturns.map(r => r.return20d);
  const signalValues = forwardReturns.map(r => r.signalValue);
  
  const avgReturn1d = returns1d.reduce((a, b) => a + b, 0) / returns1d.length;
  const avgReturn5d = returns5d.reduce((a, b) => a + b, 0) / returns5d.length;
  const avgReturn20d = returns20d.reduce((a, b) => a + b, 0) / returns20d.length;
  
  const stdDev5d = calculateStdDev(returns5d);
  const sharpe = stdDev5d > 0 ? (avgReturn5d * Math.sqrt(252 / 5)) / (stdDev5d * Math.sqrt(252 / 5)) : 0;
  
  const winRate1d = returns1d.filter(r => r > 0).length / returns1d.length;
  const winRate5d = returns5d.filter(r => r > 0).length / returns5d.length;
  const winRate20d = returns20d.filter(r => r > 0).length / returns20d.length;
  
  // Calculate max drawdown on 5d returns
  let maxDrawdown = 0;
  let peak = 1;
  let cumReturn = 1;
  for (const ret of returns5d) {
    cumReturn *= (1 + ret);
    if (cumReturn > peak) peak = cumReturn;
    const drawdown = (peak - cumReturn) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return {
    sharpe,
    avgReturn1d: avgReturn1d * 100,
    avgReturn5d: avgReturn5d * 100,
    avgReturn20d: avgReturn20d * 100,
    winRate1d: winRate1d * 100,
    winRate5d: winRate5d * 100,
    winRate20d: winRate20d * 100,
    maxDrawdown: maxDrawdown * 100,
    numTrades: forwardReturns.length,
    avgSignalValue: signalValues.reduce((a, b) => a + b, 0) / signalValues.length,
    medianSignalValue: signalValues.sort((a, b) => a - b)[Math.floor(signalValues.length / 2)]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signalType, days = 180, threshold }: BacktestRequest = await req.json();
    
    console.log(`Starting backtest for ${signalType} with threshold ${threshold}`);
    
    // Fetch historical data for all banks
    const allData = new Map<string, DailyData[]>();
    for (const bank of BANKS) {
      try {
        const data = await fetchHistoricalData(bank.ticker, days + 30);
        allData.set(bank.ticker, data);
      } catch (error) {
        console.error(`Error fetching data for ${bank.ticker}:`, error);
      }
    }
    
    // Calculate signal values
    const signalValues = await calculateSignalValues(signalType, days);
    
    // Calculate forward returns for signals that exceed threshold
    const forwardReturnsData: BacktestResult['forwardReturns'] = [];
    const forwardReturnsForStats: { return1d: number; return5d: number; return20d: number; signalValue: number }[] = [];
    
    for (const [ticker, signals] of signalValues.entries()) {
      const data = allData.get(ticker);
      if (!data) continue;
      
      signals.forEach((signal, idx) => {
        // Find corresponding price data
        const priceIdx = data.findIndex(d => d.date === signal.date);
        if (priceIdx < 0 || priceIdx + 20 >= data.length) return;
        
        // Check if signal exceeds threshold (if provided)
        const exceedsThreshold = threshold === undefined || Math.abs(signal.value) >= threshold;
        if (!exceedsThreshold) return;
        
        const fwdReturns = calculateForwardReturns(data, priceIdx);
        
        forwardReturnsData.push({
          date: signal.date,
          ticker,
          signalValue: signal.value,
          return1d: fwdReturns.return1d * 100,
          return5d: fwdReturns.return5d * 100,
          return20d: fwdReturns.return20d * 100
        });
        
        forwardReturnsForStats.push({
          ...fwdReturns,
          signalValue: signal.value
        });
      });
    }
    
    if (forwardReturnsForStats.length === 0) {
      return new Response(JSON.stringify({
        error: 'No trades found with given threshold'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const stats = calculateBacktestStats(forwardReturnsForStats);
    
    // Calculate equity curve (5-day returns)
    const equityCurve: BacktestResult['equityCurve'] = [];
    const sortedReturns = [...forwardReturnsData].sort((a, b) => a.date.localeCompare(b.date));
    let cumulativeReturn = 0;
    
    sortedReturns.forEach(ret => {
      cumulativeReturn += ret.return5d;
      equityCurve.push({
        date: ret.date,
        cumulativeReturn
      });
    });
    
    const result: BacktestResult = {
      signalName: signalType,
      threshold: threshold || 0,
      stats,
      forwardReturns: forwardReturnsData.slice(0, 100), // Limit to 100 for response size
      equityCurve: equityCurve.slice(0, 100)
    };
    
    console.log(`Backtest completed: ${stats.numTrades} trades, Sharpe ${stats.sharpe.toFixed(2)}`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in backtest calculation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
