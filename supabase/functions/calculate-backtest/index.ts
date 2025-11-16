import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALL_TICKERS = [
  'DNB.OL', 'SB1NO.OL', 'SBNOR.OL', 'MING.OL', 'SPOL.OL', 'NONG.OL',
  'MORG.OL', 'SPOG.OL', 'HELG.OL', 'ROGS.OL', 'RING.OL', 'SOAG.OL',
  'SNOR.OL', 'HGSB.OL', 'JAREN.OL', 'AURG.OL', 'SKUE.OL', 'MELG.OL',
  'SOGN.OL', 'HSPG.OL', 'VVL.OL', 'BIEN.OL'
];

const BANK_CATEGORIES: Record<string, 'Small' | 'Mid' | 'Large'> = {
  'DNB.OL': 'Large', 'SB1NO.OL': 'Large', 'SBNOR.OL': 'Large', 'MING.OL': 'Large',
  'SPOL.OL': 'Large', 'NONG.OL': 'Large', 'MORG.OL': 'Large', 'SPOG.OL': 'Mid',
  'HELG.OL': 'Mid', 'ROGS.OL': 'Mid', 'RING.OL': 'Mid', 'SOAG.OL': 'Mid',
  'SNOR.OL': 'Mid', 'HGSB.OL': 'Small', 'JAREN.OL': 'Small', 'AURG.OL': 'Small',
  'SKUE.OL': 'Small', 'MELG.OL': 'Small', 'SOGN.OL': 'Small', 'HSPG.OL': 'Small',
  'VVL.OL': 'Small', 'BIEN.OL': 'Small',
};

// ============= Interfaces =============

interface BacktestRequest {
  signalName: string;
  threshold: number;
  startDate: string;
  endDate: string;
  initialCapital: number;
  maxPositions: number;
  holdingPeriod: number;
  positionSizing: string;
  useAlphaRanking?: boolean;
  alphaMinThreshold?: number;
}

interface UnifiedSignal {
  date: string;
  ticker: string;
  signalValue: number;
  price: number;
}

interface Position {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  entryValue: number;
  signalValue: number;
}

interface Trade {
  tradeId: number;
  type: 'BUY' | 'SELL';
  ticker: string;
  date: string;
  price: number;
  shares: number;
  value: number;
  signalValue: number;
  cashBefore: number;
  cashAfter: number;
  portfolioValueBefore: number;
  portfolioValueAfter: number;
  entryDate?: string;
  entryPrice?: number;
  holdingDays?: number;
  pnl?: number;
  return?: number;
  closeReason?: string;
}

interface EquityCurvePoint {
  date: string;
  portfolioValue: number;
  cumulativeReturn: number;
  numPositions: number;
  cashBalance: number;
  utilization: number;
}

interface TradeMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgTradeSize: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingDays: number;
  avgCashUtilization: number;
}

// ============= Signal Function Mapping =============

function getSignalFunctionName(signalName: string): string {
  const mapping: Record<string, string> = {
    'abnormal_volume': 'calculate-abnormal-volume',
    'lars': 'calculate-lars',
    'alpha_engine': 'calculate-alpha-engine',
    'vdi': 'calculate-vdi',
    'ssi': 'calculate-ssi',
    'rotation': 'calculate-rotation',
    'smfi': 'calculate-smfi'
  };
  return mapping[signalName] || signalName;
}

function calculateDaysNeeded(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(diffDays + 60, 365);
}

// ============= Historical Price Fetching =============

async function fetchHistoricalPrices(
  tickers: string[], 
  startDate: string, 
  endDate: string
): Promise<Map<string, Map<string, number>>> {
  console.log(`Fetching prices for ${tickers.length} tickers...`);
  const priceMap = new Map<string, Map<string, number>>();
  
  const startTs = Math.floor(new Date(startDate).getTime() / 1000) - (30 * 24 * 60 * 60);
  const endTs = Math.floor(new Date(endDate).getTime() / 1000) + (24 * 60 * 60);
  
  const fetchPromises = tickers.map(async ticker => {
    try {
      const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTs}&period2=${endTs}&interval=1d`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch ${ticker}: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result || !result.timestamp) {
        console.error(`No data for ${ticker}`);
        return;
      }
      
      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      
      const tickerPrices = new Map<string, number>();
      timestamps.forEach((ts: number, i: number) => {
        if (closes[i] && closes[i] > 0) {
          const date = new Date(ts * 1000).toISOString().split('T')[0];
          tickerPrices.set(date, closes[i]);
        }
      });
      
      priceMap.set(ticker, tickerPrices);
    } catch (error) {
      console.error(`Error fetching ${ticker}:`, error);
    }
  });
  
  await Promise.all(fetchPromises);
  console.log(`Fetched prices for ${priceMap.size} tickers`);
  
  return priceMap;
}

// ============= Signal Transformation =============

function transformSignalData(
  signalName: string, 
  rawData: any, 
  threshold: number
): UnifiedSignal[] {
  console.log(`Transforming ${signalName} signals with threshold ${threshold}`);
  
  switch (signalName) {
    case 'abnormal_volume':
      return transformAbnormalVolume(rawData, threshold);
    case 'lars':
      return transformLARS(rawData, threshold);
    case 'alpha_engine':
      return transformAlphaEngine(rawData, threshold);
    case 'vdi':
      return transformVDI(rawData, threshold);
    case 'ssi':
      return transformSSI(rawData, threshold);
    case 'rotation':
      return transformRotation(rawData, threshold);
    case 'smfi':
      return transformSMFI(rawData, threshold);
    default:
      console.error(`Unknown signal type: ${signalName}`);
      return [];
  }
}

function transformAbnormalVolume(data: any, threshold: number): UnifiedSignal[] {
  if (!data.volumeData) return [];
  
  const signals: UnifiedSignal[] = [];
  const latestDate = new Date().toISOString().split('T')[0];
  
  data.volumeData
    .filter((bank: any) => Math.abs(bank.zScore) >= threshold)
    .forEach((bank: any) => {
      signals.push({
        date: latestDate,
        ticker: bank.ticker,
        signalValue: Math.abs(bank.zScore),
        price: 0
      });
    });
  
  console.log(`Abnormal Volume: ${signals.length} signals`);
  return signals;
}

function transformLARS(data: any, threshold: number): UnifiedSignal[] {
  if (!data.larsTimeSeries) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.larsTimeSeries
    .filter((point: any) => Math.abs(point.lars) >= threshold)
    .forEach((point: any) => {
      ALL_TICKERS.forEach(ticker => {
        signals.push({
          date: point.date,
          ticker: ticker,
          signalValue: Math.abs(point.lars),
          price: 0
        });
      });
    });
  
  console.log(`LARS: ${signals.length} signals across ${data.larsTimeSeries.length} dates`);
  return signals;
}

function transformAlphaEngine(data: any, threshold: number): UnifiedSignal[] {
  if (!data.timeSeriesData) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.timeSeriesData.forEach((point: any) => {
    if (point.banks) {
      point.banks
        .filter((bank: any) => bank.basEMA >= threshold)
        .forEach((bank: any) => {
          signals.push({
            date: point.date,
            ticker: bank.ticker,
            signalValue: bank.basEMA,
            price: bank.close || 0
          });
        });
    }
  });
  
  console.log(`Alpha Engine: ${signals.length} signals`);
  return signals;
}

function transformVDI(data: any, threshold: number): UnifiedSignal[] {
  if (!data.vdiTimeSeries) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.vdiTimeSeries
    .filter((point: any) => Math.abs(point.vdi) >= threshold)
    .forEach((point: any) => {
      ALL_TICKERS.forEach(ticker => {
        signals.push({
          date: point.date,
          ticker: ticker,
          signalValue: Math.abs(point.vdi),
          price: 0
        });
      });
    });
  
  console.log(`VDI: ${signals.length} signals`);
  return signals;
}

function transformSSI(data: any, threshold: number): UnifiedSignal[] {
  if (!data.ssiTimeSeries) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.ssiTimeSeries
    .filter((point: any) => Math.abs(point.ssi) >= threshold)
    .forEach((point: any) => {
      ALL_TICKERS.forEach(ticker => {
        signals.push({
          date: point.date,
          ticker: ticker,
          signalValue: Math.abs(point.ssi),
          price: 0
        });
      });
    });
  
  console.log(`SSI: ${signals.length} signals`);
  return signals;
}

function transformRotation(data: any, threshold: number): UnifiedSignal[] {
  if (!data.rotationData) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.rotationData.forEach((point: any) => {
    const categories = {
      'Small': point.smallCap || 0,
      'Mid': point.midCap || 0,
      'Large': point.largeCap || 0
    };
    
    const topCategory = Object.entries(categories)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    const topCategoryName = topCategory[0] as 'Small' | 'Mid' | 'Large';
    const topCategoryValue = topCategory[1] as number;
    
    if (topCategoryValue >= threshold) {
      Object.entries(BANK_CATEGORIES)
        .filter(([, cat]) => cat === topCategoryName)
        .forEach(([ticker]) => {
          signals.push({
            date: point.date,
            ticker: ticker,
            signalValue: topCategoryValue,
            price: 0
          });
        });
    }
  });
  
  console.log(`Rotation: ${signals.length} signals`);
  return signals;
}

function transformSMFI(data: any, threshold: number): UnifiedSignal[] {
  if (!data.smfiTimeSeries) return [];
  
  const signals: UnifiedSignal[] = [];
  
  data.smfiTimeSeries
    .filter((point: any) => Math.abs(point.smfi) >= threshold)
    .forEach((point: any) => {
      ALL_TICKERS.forEach(ticker => {
        signals.push({
          date: point.date,
          ticker: ticker,
          signalValue: Math.abs(point.smfi),
          price: 0
        });
      });
    });
  
  console.log(`SMFI: ${signals.length} signals`);
  return signals;
}

// ============= Portfolio Simulation =============

function calculatePortfolioValue(
  positions: Position[], 
  date: string, 
  priceMap: Map<string, Map<string, number>>
): number {
  return positions.reduce((total, pos) => {
    const currentPrice = priceMap.get(pos.ticker)?.get(date) || pos.entryPrice;
    return total + (pos.shares * currentPrice);
  }, 0);
}

async function simulatePortfolio(
  signals: UnifiedSignal[],
  priceMap: Map<string, Map<string, number>>,
  config: BacktestRequest,
  alphaScores?: Map<string, Map<string, number>> // date -> ticker -> alpha score
): Promise<{
  trades: Trade[];
  equityCurve: EquityCurvePoint[];
  finalCash: number;
  activePositions: Position[];
}> {
  console.log('Starting portfolio simulation...');
  
  let cash = config.initialCapital;
  let activePositions: Position[] = [];
  const trades: Trade[] = [];
  const equityCurve: EquityCurvePoint[] = [];
  let tradeCounter = 0;
  
  const allDates = [...new Set(signals.map(s => s.date))].sort();
  console.log(`Simulating ${allDates.length} trading days`);
  
  for (const date of allDates) {
    if (date < config.startDate || date > config.endDate) continue;
    
    // 1. Close positions (holding period exceeded)
    const positionsToClose = activePositions.filter(pos => {
      const entryDate = new Date(pos.entryDate);
      const currentDate = new Date(date);
      const daysDiff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= config.holdingPeriod;
    });
    
    for (const position of positionsToClose) {
      const exitPrice = priceMap.get(position.ticker)?.get(date) || position.entryPrice;
      const exitValue = position.shares * exitPrice;
      const pnl = exitValue - position.entryValue;
      const returnPct = (pnl / position.entryValue) * 100;
      
      const portfolioValueBefore = calculatePortfolioValue(activePositions, date, priceMap) + cash;
      cash += exitValue;
      activePositions = activePositions.filter(p => p !== position);
      const portfolioValueAfter = calculatePortfolioValue(activePositions, date, priceMap) + cash;
      
      trades.push({
        tradeId: tradeCounter++,
        type: 'SELL',
        ticker: position.ticker,
        date,
        price: exitPrice,
        shares: position.shares,
        value: exitValue,
        signalValue: position.signalValue,
        cashBefore: cash - exitValue,
        cashAfter: cash,
        portfolioValueBefore,
        portfolioValueAfter,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        holdingDays: Math.floor((new Date(date).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)),
        pnl,
        return: returnPct,
        closeReason: 'HOLDING_PERIOD'
      });
    }
    
    // 2. Open new positions (signals triggered)
    let todaysSignals = signals
      .filter(s => s.date === date && s.signalValue >= config.threshold)
      .filter(s => !activePositions.some(p => p.ticker === s.ticker));
    
    // If alpha ranking is enabled, rank by alpha scores
    if (alphaScores && config.useAlphaRanking) {
      const alphaForDate = alphaScores.get(date);
      if (alphaForDate) {
        // Filter by minimum alpha threshold and add alpha scores
        todaysSignals = todaysSignals
          .map(s => ({
            ...s,
            alphaScore: alphaForDate.get(s.ticker) || -999
          }))
          .filter(s => s.alphaScore >= (config.alphaMinThreshold || -999))
          .sort((a, b) => b.alphaScore - a.alphaScore);
        
        console.log(`${date}: ${todaysSignals.length} signals after alpha filtering (min: ${config.alphaMinThreshold})`);
      } else {
        console.log(`${date}: No alpha data available for ranking`);
        todaysSignals.sort((a, b) => b.signalValue - a.signalValue);
      }
    } else {
      // Default: rank by signal value
      todaysSignals.sort((a, b) => b.signalValue - a.signalValue);
    }
    
    const availableSlots = config.maxPositions - activePositions.length;
    const signalsToExecute = todaysSignals.slice(0, availableSlots);
    
    for (const signal of signalsToExecute) {
      let price = signal.price;
      if (!price || price <= 0) {
        price = priceMap.get(signal.ticker)?.get(date) || 0;
      }
      if (!price || price <= 0) continue;
      
      const remainingSlots = config.maxPositions - activePositions.length;
      if (remainingSlots <= 0) break;
      
      const positionSize = cash / remainingSlots;
      const shares = Math.floor(positionSize / price);
      const actualValue = shares * price;
      
      if (actualValue <= cash && shares > 0) {
        const portfolioValueBefore = calculatePortfolioValue(activePositions, date, priceMap) + cash;
        cash -= actualValue;
        
        const newPosition: Position = {
          ticker: signal.ticker,
          entryDate: date,
          entryPrice: price,
          shares,
          entryValue: actualValue,
          signalValue: signal.signalValue
        };
        
        activePositions.push(newPosition);
        const portfolioValueAfter = calculatePortfolioValue(activePositions, date, priceMap) + cash;
        
        trades.push({
          tradeId: tradeCounter++,
          type: 'BUY',
          ticker: signal.ticker,
          date,
          price,
          shares,
          value: actualValue,
          signalValue: signal.signalValue,
          cashBefore: cash + actualValue,
          cashAfter: cash,
          portfolioValueBefore,
          portfolioValueAfter
        });
      }
    }
    
    // 3. Record equity curve point
    const portfolioValue = calculatePortfolioValue(activePositions, date, priceMap) + cash;
    const cumulativeReturn = ((portfolioValue - config.initialCapital) / config.initialCapital) * 100;
    const investedValue = portfolioValue - cash;
    const utilization = portfolioValue > 0 ? (investedValue / portfolioValue) * 100 : 0;
    
    equityCurve.push({
      date,
      portfolioValue,
      cumulativeReturn,
      numPositions: activePositions.length,
      cashBalance: cash,
      utilization
    });
  }
  
  console.log(`Simulation complete: ${trades.length} total trades, ${activePositions.length} active positions`);
  
  return { trades, equityCurve, finalCash: cash, activePositions };
}

// ============= Trade Metrics Calculation =============

function calculateTradeMetrics(trades: Trade[], equityCurve: EquityCurvePoint[]): TradeMetrics {
  const completedTrades = trades.filter(t => t.type === 'SELL' && t.pnl !== undefined);
  
  if (completedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgTradeSize: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgHoldingDays: 0,
      avgCashUtilization: 0
    };
  }
  
  const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = completedTrades.filter(t => (t.pnl || 0) <= 0);
  
  const totalWinnings = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  
  const profitFactor = totalLosses > 0 ? totalWinnings / totalLosses : totalWinnings > 0 ? 999 : 0;
  
  const avgTradeSize = trades
    .filter(t => t.type === 'BUY')
    .reduce((sum, t) => sum + t.value, 0) / trades.filter(t => t.type === 'BUY').length;
  
  const returns = completedTrades.map(t => t.return || 0);
  const bestTrade = returns.length > 0 ? Math.max(...returns) : 0;
  const worstTrade = returns.length > 0 ? Math.min(...returns) : 0;
  
  const avgHoldingDays = completedTrades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) / completedTrades.length;
  
  const avgCashUtilization = equityCurve.reduce((sum, p) => sum + p.utilization, 0) / equityCurve.length;
  
  return {
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: (winningTrades.length / completedTrades.length) * 100,
    profitFactor,
    avgTradeSize,
    bestTrade,
    worstTrade,
    avgHoldingDays,
    avgCashUtilization
  };
}

// ============= Main Handler =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const params: BacktestRequest = await req.json();
    console.log('Backtest request:', params);

    // Step 1: Fetch signals from database
    console.log(`Fetching signals from database for ${params.signalName}...`);
    
    const { data: dbSignals, error: dbError } = await supabase
      .from('signal_history')
      .select('*')
      .eq('signal_type', params.signalName)
      .gte('date', params.startDate)
      .lte('date', params.endDate)
      .order('date', { ascending: true });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to fetch signals from database: ${dbError.message}`);
    }

    if (!dbSignals || dbSignals.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No historical signals found',
          message: 'Please run the backfill function first to populate signal history',
          suggestion: 'Call the backfill-signal-history function to initialize historical data'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Found ${dbSignals.length} signals in database`);

    // Step 2: Transform database signals to unified format and apply threshold
    const unifiedSignals: UnifiedSignal[] = dbSignals
      .filter(s => Math.abs(s.signal_value) >= params.threshold)
      .map(s => ({
        date: s.date,
        ticker: s.ticker,
        signalValue: s.signal_value,
        price: 0 // Will be filled from price data
      }));
    
    if (unifiedSignals.length === 0) {
      console.warn('No signals generated for the given threshold');
    }
    
    // Step 3: Fetch alpha scores if alpha ranking is enabled
    let alphaScores: Map<string, Map<string, number>> | undefined;
    if (params.useAlphaRanking) {
      console.log('Fetching alpha_engine scores for ranking...');
      const { data: alphaData, error: alphaError } = await supabase
        .from('signal_history')
        .select('*')
        .eq('signal_type', 'alpha_engine')
        .gte('date', params.startDate)
        .lte('date', params.endDate);
      
      if (!alphaError && alphaData && alphaData.length > 0) {
        console.log(`Found ${alphaData.length} alpha_engine records`);
        alphaScores = new Map();
        
        alphaData.forEach(record => {
          if (!alphaScores!.has(record.date)) {
            alphaScores!.set(record.date, new Map());
          }
          alphaScores!.get(record.date)!.set(record.ticker, record.signal_value);
        });
        
        console.log(`Alpha scores loaded for ${alphaScores.size} dates`);
      } else {
        console.warn('No alpha_engine data found for ranking. Will use signal values instead.');
      }
    }
    
    // Step 4: Fetch historical prices for all tickers
    const allTickers = [...new Set(unifiedSignals.map(s => s.ticker))];
    const priceMap = await fetchHistoricalPrices(allTickers, params.startDate, params.endDate);
    
    // Step 5: Fill in prices in unified signals
    unifiedSignals.forEach(signal => {
      if (signal.price === 0) {
        signal.price = priceMap.get(signal.ticker)?.get(signal.date) || 0;
      }
    });
    
    // Remove signals without valid prices
    const validSignals = unifiedSignals.filter(s => s.price > 0);
    console.log(`Valid signals with prices: ${validSignals.length} / ${unifiedSignals.length}`);
    
    // Step 6: Run portfolio simulation
    const { trades, equityCurve, finalCash, activePositions } = await simulatePortfolio(
      validSignals,
      priceMap,
      params,
      alphaScores
    );
    
    // Step 7: Calculate trade metrics
    const tradeMetrics = calculateTradeMetrics(trades, equityCurve);
    
    // Step 7: Calculate backtest statistics
    const finalValue = equityCurve.length > 0 
      ? equityCurve[equityCurve.length - 1].portfolioValue 
      : params.initialCapital;
    
    const totalReturn = ((finalValue - params.initialCapital) / params.initialCapital) * 100;
    
    const returns = equityCurve.map((point, i) => {
      if (i === 0) return 0;
      const prevValue = equityCurve[i - 1].portfolioValue;
      return prevValue > 0 ? ((point.portfolioValue - prevValue) / prevValue) * 100 : 0;
    });
    
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
      : 0;
    const stdReturn = Math.sqrt(variance);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;
    
    let maxDrawdown = 0;
    let peak = params.initialCapital;
    equityCurve.forEach(point => {
      if (point.portfolioValue > peak) peak = point.portfolioValue;
      const drawdown = peak > 0 ? ((peak - point.portfolioValue) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    
    const tradingDays = equityCurve.length;
    const annualizedReturn = tradingDays > 0 ? totalReturn * (252 / tradingDays) : 0;
    
    const result = {
      signalName: params.signalName,
      threshold: params.threshold,
      config: {
        initialCapital: params.initialCapital,
        maxPositions: params.maxPositions,
        holdingPeriod: params.holdingPeriod,
        positionSizing: params.positionSizing,
        startDate: params.startDate,
        endDate: params.endDate
      },
      stats: {
        initialCapital: params.initialCapital,
        finalValue,
        totalReturn,
        annualizedReturn,
        sharpeRatio,
        maxDrawdown
      },
      tradeMetrics,
      trades,
      activePositions,
      equityCurve
    };

    console.log(`Backtest complete: Final value ${finalValue.toFixed(0)}, Total return ${totalReturn.toFixed(2)}%`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backtest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
