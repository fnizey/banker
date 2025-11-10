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

interface DailyPrice {
  date: string;
  close: number;
}

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
  const closes = result.indicators.quote[0].close;
  
  return timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    close: closes[i],
  })).filter((d: DailyPrice) => d.close !== null);
}

function calculateMarketCap(close: number, sharesOutstanding: number): number {
  return (close * sharesOutstanding) / 1e9; // in billion NOK
}

function categorizeBankBySize(marketCap: number): 'Small' | 'Mid' | 'Large' {
  if (marketCap < 10) return 'Small';
  if (marketCap < 50) return 'Mid';
  return 'Large';
}

function calculateCumulativeReturn(prices: number[]): number[] {
  const returns: number[] = [0]; // Start at 0% return
  
  for (let i = 1; i < prices.length; i++) {
    const cumulativeReturn = ((prices[i] - prices[0]) / prices[0]) * 100;
    returns.push(cumulativeReturn);
  }
  
  return returns;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting performance calculation...');
    const days = 365; // Always use 12 months
    
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
    const validPrices = allPricesResults.filter((r): r is { ticker: string; name: string; prices: DailyPrice[] } => 
      r !== null && r.prices.length > 1
    );
    
    console.log(`Fetched data for ${validPrices.length} banks`);
    
    // Categorize banks by market cap (using latest data)
    const categorizedBanks = validPrices.map(({ ticker, name, prices }) => {
      const latestPrice = prices[prices.length - 1];
      const sharesOutstanding = SHARES_OUTSTANDING[ticker] || 0;
      const marketCap = calculateMarketCap(latestPrice.close, sharesOutstanding);
      const category = categorizeBankBySize(marketCap);
      
      console.log(`${name} (${ticker}): Close=${latestPrice.close.toFixed(2)}, Shares=${(sharesOutstanding/1e6).toFixed(1)}M, MarketCap=${marketCap.toFixed(2)} mrd NOK → ${category}`);
      
      // Calculate cumulative returns for this bank
      const priceValues = prices.map(p => p.close);
      const cumulativeReturns = calculateCumulativeReturn(priceValues);
      
      return { 
        ticker, 
        name, 
        prices, 
        category, 
        marketCap,
        cumulativeReturns,
        dates: prices.map(p => p.date)
      };
    });
    
    console.log(`Categories: Small=${categorizedBanks.filter(b => b.category === 'Small').length}, Mid=${categorizedBanks.filter(b => b.category === 'Mid').length}, Large=${categorizedBanks.filter(b => b.category === 'Large').length}`);
    
    // Get all unique dates
    const allDates = [...new Set(categorizedBanks.flatMap(b => b.dates))].sort();
    
    console.log(`Processing ${allDates.length} dates`);
    
    // Calculate average cumulative return for each category at each date
    const performanceTimeSeries = allDates.map(date => {
      const categoriesData: Record<string, number[]> = {
        Small: [],
        Mid: [],
        Large: []
      };
      
      // Collect cumulative returns for each category
      for (const bank of categorizedBanks) {
        const dateIndex = bank.dates.indexOf(date);
        if (dateIndex !== -1) {
          categoriesData[bank.category].push(bank.cumulativeReturns[dateIndex]);
        }
      }
      
      // Calculate average for each category
      const avgReturns: Record<string, number> = {};
      for (const [category, returns] of Object.entries(categoriesData)) {
        if (returns.length > 0) {
          avgReturns[category] = returns.reduce((a, b) => a + b, 0) / returns.length;
        } else {
          avgReturns[category] = 0;
        }
      }
      
      return {
        date,
        Small: avgReturns['Small'] || 0,
        Mid: avgReturns['Mid'] || 0,
        Large: avgReturns['Large'] || 0
      };
    });
    
    // Get current performance (last date)
    const currentPerformance = performanceTimeSeries[performanceTimeSeries.length - 1];
    
    // Get bank categorization for UI
    const banksByCategory = {
      Small: categorizedBanks.filter(b => b.category === 'Small').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap })),
      Mid: categorizedBanks.filter(b => b.category === 'Mid').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap })),
      Large: categorizedBanks.filter(b => b.category === 'Large').map(b => ({ name: b.name, ticker: b.ticker, marketCap: b.marketCap }))
    };
    
    console.log('Performance calculation completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        performanceTimeSeries,
        currentPerformance,
        banksByCategory
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error calculating performance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
