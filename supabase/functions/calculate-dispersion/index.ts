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

async function fetchHistoricalPrices(ticker: string, days: number) {
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
  const closes = result.indicators.adjclose?.[0]?.adjclose || result.indicators.quote[0].close;
  
  return timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    price: closes[i]
  })).filter((d: any) => d.price !== null);
}

function calculateDailyReturns(prices: { date: string; price: number }[]) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = ((prices[i].price - prices[i - 1].price) / prices[i - 1].price) * 100;
    returns.push({
      date: prices[i].date,
      return: dailyReturn
    });
  }
  return returns;
}

function calculateStdDev(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { days = 90 } = await req.json();
    
    // Fetch historical prices for all banks
    const allPricesPromises = BANKS.map(bank => 
      fetchHistoricalPrices(bank.ticker, days)
        .then(prices => ({ ticker: bank.ticker, name: bank.name, prices }))
        .catch(err => {
          console.error(`Error fetching ${bank.ticker}:`, err);
          return null;
        })
    );
    
    const allPricesResults = await Promise.all(allPricesPromises);
    const validPrices = allPricesResults.filter((r): r is { ticker: string; name: string; prices: { date: string; price: number }[] } => 
      r !== null && r.prices.length > 0
    );
    
    // Calculate daily returns for each bank
    const allReturns = validPrices.map(({ ticker, name, prices }) => ({
      ticker,
      name,
      returns: calculateDailyReturns(prices)
    }));
    
    // Get all unique dates
    const allDates = [...new Set(allReturns.flatMap(r => r.returns.map(ret => ret.date)))].sort();
    
    // Calculate cross-sectional dispersion for each date
    const dispersionTimeSeries = allDates.map(date => {
      const returnsForDate = allReturns
        .map(r => r.returns.find(ret => ret.date === date)?.return)
        .filter((ret): ret is number => ret !== undefined && !isNaN(ret));
      
      if (returnsForDate.length < 3) return null;
      
      const dispersion = calculateStdDev(returnsForDate);
      return { date, dispersion };
    }).filter((d): d is { date: string; dispersion: number } => d !== null);
    
    // Get current dispersion (last date)
    const currentDispersion = dispersionTimeSeries[dispersionTimeSeries.length - 1]?.dispersion || 0;
    
    // Get today's top and bottom performers
    const lastDate = allDates[allDates.length - 1];
    const todayReturns = allReturns.map(({ ticker, name, returns }) => ({
      ticker,
      name,
      dailyReturn: returns.find(r => r.date === lastDate)?.return || 0
    })).filter(r => !isNaN(r.dailyReturn));
    
    todayReturns.sort((a, b) => b.dailyReturn - a.dailyReturn);
    
    const topPerformers = todayReturns.slice(0, 5);
    const bottomPerformers = todayReturns.slice(-5).reverse();
    
    return new Response(
      JSON.stringify({
        success: true,
        dispersionTimeSeries,
        currentDispersion,
        topPerformers,
        bottomPerformers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error calculating dispersion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
