import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BacktestRequest {
  signalName: string;
  threshold: number;
  startDate: string;
  endDate: string;
  initialCapital: number;
  maxPositions: number;
  holdingPeriod: number;
  positionSizing: 'equal' | 'signal' | 'volatility';
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

interface Position {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  entryValue: number;
  signalValue: number;
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
  totalBuys: number;
  totalSells: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgTradeSize: number;
  largestTrade: number;
  smallestTrade: number;
  totalPnL: number;
  avgWinSize: number;
  avgLossSize: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  avgHoldingDays: number;
  minHoldingDays: number;
  maxHoldingDays: number;
  avgConcurrentPositions: number;
  maxConcurrentPositions: number;
  avgCashUtilization: number;
}

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

    const { signalName, threshold, startDate, endDate, initialCapital, maxPositions, holdingPeriod, positionSizing } = params;

    // Fetch signal data
    const { data: signalData, error: signalError } = await supabase
      .from(signalName)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (signalError) throw signalError;

    // Fetch price data for all unique tickers
    const uniqueTickers = [...new Set(signalData.map((s: any) => s.ticker))];
    const { data: priceData, error: priceError } = await supabase
      .from('stock_data')
      .select('ticker, date, close')
      .in('ticker', uniqueTickers)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (priceError) throw priceError;

    // Build price lookup map
    const priceMap = new Map<string, Map<string, number>>();
    priceData.forEach((p: any) => {
      if (!priceMap.has(p.ticker)) {
        priceMap.set(p.ticker, new Map());
      }
      priceMap.get(p.ticker)!.set(p.date, p.close);
    });

    // Get all unique dates
    const allDates = [...new Set(signalData.map((s: any) => s.date))].sort();

    // Simulate portfolio
    const simulation = simulatePortfolio(
      signalData,
      priceMap,
      allDates,
      initialCapital,
      maxPositions,
      holdingPeriod,
      threshold,
      positionSizing
    );

    // Calculate trade metrics
    const tradeMetrics = calculateTradeMetrics(simulation.trades, simulation.equityCurve, initialCapital);

    // Calculate standard backtest stats
    const returns = simulation.equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.portfolioValue - simulation.equityCurve[i - 1].portfolioValue) / simulation.equityCurve[i - 1].portfolioValue;
    }).filter(r => r !== 0);

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = avgReturn / stdDev * Math.sqrt(252);

    let maxDrawdown = 0;
    let peak = simulation.equityCurve[0].portfolioValue;
    simulation.equityCurve.forEach(point => {
      if (point.portfolioValue > peak) {
        peak = point.portfolioValue;
      }
      const drawdown = (peak - point.portfolioValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const finalValue = simulation.equityCurve[simulation.equityCurve.length - 1].portfolioValue;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
    const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (Math.pow(finalValue / initialCapital, 365 / days) - 1) * 100;

    const result = {
      signalName,
      threshold,
      config: {
        initialCapital,
        maxPositions,
        holdingPeriod,
        positionSizing,
      },
      stats: {
        totalReturn,
        annualizedReturn,
        sharpeRatio,
        maxDrawdown: maxDrawdown * 100,
        finalValue,
        initialCapital,
      },
      tradeMetrics,
      trades: simulation.trades,
      activePositions: simulation.activePositions,
      equityCurve: simulation.equityCurve,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backtest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function simulatePortfolio(
  signalData: any[],
  priceMap: Map<string, Map<string, number>>,
  allDates: string[],
  initialCapital: number,
  maxPositions: number,
  holdingPeriod: number,
  threshold: number,
  positionSizing: string
) {
  let cash = initialCapital;
  let activePositions: Position[] = [];
  let trades: Trade[] = [];
  let tradeCounter = 0;
  const equityCurve: EquityCurvePoint[] = [];

  const daysSince = (dateStr1: string, dateStr2: string) => {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPortfolioValue = (positions: Position[], date: string) => {
    return positions.reduce((sum, pos) => {
      const price = priceMap.get(pos.ticker)?.get(date) || pos.entryPrice;
      return sum + (pos.shares * price);
    }, 0);
  };

  for (const date of allDates) {
    // 1. CLOSE POSITIONS (SELL)
    const positionsToClose = activePositions.filter(p => 
      daysSince(p.entryDate, date) >= holdingPeriod
    );
    
    for (const position of positionsToClose) {
      const currentPrice = priceMap.get(position.ticker)?.get(date) || position.entryPrice;
      const sellValue = position.shares * currentPrice;
      const pnl = sellValue - position.entryValue;
      const returnPct = (pnl / position.entryValue) * 100;
      
      const portfolioValueBefore = cash + getPortfolioValue(activePositions, date);
      
      trades.push({
        tradeId: tradeCounter++,
        type: 'SELL',
        ticker: position.ticker,
        date,
        price: currentPrice,
        shares: position.shares,
        value: sellValue,
        signalValue: position.signalValue,
        cashBefore: cash,
        cashAfter: cash + sellValue,
        portfolioValueBefore,
        portfolioValueAfter: cash + sellValue + getPortfolioValue(activePositions.filter(p => p !== position), date),
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        holdingDays: daysSince(position.entryDate, date),
        pnl,
        return: returnPct,
        closeReason: 'HOLDING_PERIOD'
      });
      
      cash += sellValue;
      activePositions = activePositions.filter(p => p !== position);
    }
    
    // 2. OPEN NEW POSITIONS (BUY)
    const triggeredSignals = signalData.filter(s => 
      s.date === date && 
      s.signal_value >= threshold &&
      !activePositions.some(p => p.ticker === s.ticker) // Don't buy if already holding
    );
    
    const topSignals = triggeredSignals
      .sort((a, b) => b.signal_value - a.signal_value)
      .slice(0, maxPositions - activePositions.length);
    
    for (const signal of topSignals) {
      const availableSlots = maxPositions - activePositions.length;
      if (availableSlots <= 0) break;
      
      const positionSize = positionSizing === 'equal' 
        ? cash / availableSlots 
        : (cash / availableSlots) * (signal.signal_value / threshold);
      
      const price = priceMap.get(signal.ticker)?.get(date);
      if (!price) continue;
      
      const shares = Math.floor(positionSize / price);
      const actualValue = shares * price;
      
      if (actualValue <= cash && shares > 0) {
        const portfolioValueBefore = cash + getPortfolioValue(activePositions, date);
        
        trades.push({
          tradeId: tradeCounter++,
          type: 'BUY',
          ticker: signal.ticker,
          date,
          price,
          shares,
          value: actualValue,
          signalValue: signal.signal_value,
          cashBefore: cash,
          cashAfter: cash - actualValue,
          portfolioValueBefore,
          portfolioValueAfter: cash - actualValue + getPortfolioValue(activePositions, date) + actualValue
        });
        
        cash -= actualValue;
        activePositions.push({
          ticker: signal.ticker,
          entryDate: date,
          entryPrice: price,
          shares,
          entryValue: actualValue,
          signalValue: signal.signal_value
        });
      }
    }
    
    // 3. RECORD EQUITY CURVE POINT
    const portfolioValue = cash + getPortfolioValue(activePositions, date);
    const cumulativeReturn = ((portfolioValue - initialCapital) / initialCapital) * 100;
    const utilization = ((portfolioValue - cash) / portfolioValue) * 100;
    
    equityCurve.push({
      date,
      portfolioValue,
      cumulativeReturn,
      numPositions: activePositions.length,
      cashBalance: cash,
      utilization
    });
  }

  return { trades, activePositions, equityCurve };
}

function calculateTradeMetrics(trades: Trade[], equityCurve: EquityCurvePoint[], initialCapital: number): TradeMetrics {
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const buyTrades = trades.filter(t => t.type === 'BUY');
  
  const winningTrades = sellTrades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = sellTrades.filter(t => (t.pnl || 0) <= 0);
  
  const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
  
  const avgWinSize = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length 
    : 0;
  
  const avgLossSize = losingTrades.length > 0 
    ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length 
    : 0;
  
  const bestTrade = sellTrades.reduce((best, t) => 
    (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, 
    null as Trade | null
  );
  
  const worstTrade = sellTrades.reduce((worst, t) => 
    (!worst || (t.pnl || 0) < (worst.pnl || 0)) ? t : worst, 
    null as Trade | null
  );
  
  const avgHoldingDays = sellTrades.length > 0
    ? sellTrades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) / sellTrades.length
    : 0;
  
  const holdingDays = sellTrades.map(t => t.holdingDays || 0).filter(d => d > 0);
  const minHoldingDays = holdingDays.length > 0 ? Math.min(...holdingDays) : 0;
  const maxHoldingDays = holdingDays.length > 0 ? Math.max(...holdingDays) : 0;
  
  const avgConcurrentPositions = equityCurve.length > 0
    ? equityCurve.reduce((sum, p) => sum + p.numPositions, 0) / equityCurve.length
    : 0;
  
  const maxConcurrentPositions = equityCurve.length > 0
    ? Math.max(...equityCurve.map(p => p.numPositions))
    : 0;
  
  const avgCashUtilization = equityCurve.length > 0
    ? equityCurve.reduce((sum, p) => sum + p.utilization, 0) / equityCurve.length
    : 0;
  
  const tradeSizes = buyTrades.map(t => t.value);
  const avgTradeSize = tradeSizes.length > 0
    ? tradeSizes.reduce((sum, v) => sum + v, 0) / tradeSizes.length
    : 0;
  
  return {
    totalTrades: trades.length,
    totalBuys: buyTrades.length,
    totalSells: sellTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0,
    profitFactor,
    avgTradeSize,
    largestTrade: tradeSizes.length > 0 ? Math.max(...tradeSizes) : 0,
    smallestTrade: tradeSizes.length > 0 ? Math.min(...tradeSizes) : 0,
    totalPnL: sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    avgWinSize,
    avgLossSize,
    bestTrade,
    worstTrade,
    avgHoldingDays,
    minHoldingDays,
    maxHoldingDays,
    avgConcurrentPositions,
    maxConcurrentPositions,
    avgCashUtilization
  };
}
