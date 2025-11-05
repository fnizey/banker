import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FinancialDataRequest {
  ticker: string;
  dataType: 'financials' | 'dividends' | 'splits' | 'holders';
  period?: 'annual' | 'quarterly';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker, dataType, period = 'quarterly' }: FinancialDataRequest = await req.json();
    
    console.log(`Fetching ${dataType} for ${ticker}, period: ${period}`);

    if (!ticker || !dataType) {
      throw new Error('Missing required parameters: ticker and dataType');
    }

    let data;

    switch (dataType) {
      case 'financials':
        data = await fetchFinancials(ticker, period);
        break;
      case 'dividends':
        data = await fetchDividends(ticker);
        break;
      case 'splits':
        data = await fetchSplits(ticker);
        break;
      case 'holders':
        data = await fetchHolders(ticker);
        break;
      default:
        throw new Error(`Unknown dataType: ${dataType}`);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-financial-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function fetchFinancials(ticker: string, period: 'annual' | 'quarterly') {
  const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }

  // RapidAPI Yahoo Finance endpoint
  const endpoint = period === 'annual' ? 'annual' : 'quarterly';
  const url = `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/modules?ticker=${ticker}&module=income-statement,balance-sheet,cash-flow&type=${endpoint}`;
  
  console.log(`Fetching from RapidAPI: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'yahoo-finance15.p.rapidapi.com'
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('RapidAPI error response:', errorText);
    throw new Error(`RapidAPI error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('RapidAPI response structure:', Object.keys(data));
  
  if (!data || !data.body) {
    return { statements: [] };
  }
  
  // Parse RapidAPI response structure
  const result = data.body;
  const incomeStatement = result['income-statement']?.[endpoint] || [];
  const balanceSheet = result['balance-sheet']?.[endpoint] || [];
  const cashFlow = result['cash-flow']?.[endpoint] || [];
  
  // Combine all data by date
  const statementsMap = new Map();
  
  incomeStatement.forEach((stmt: any) => {
    const date = stmt.asOfDate || stmt.date;
    if (!date) return;
    
    statementsMap.set(date, {
      date,
      revenue: stmt.TotalRevenue,
      netIncome: stmt.NetIncome,
      operatingIncome: stmt.OperatingIncome,
      grossProfit: stmt.GrossProfit,
      eps: stmt.BasicEPS,
      ebitda: stmt.EBITDA,
    });
  });
  
  balanceSheet.forEach((stmt: any) => {
    const date = stmt.asOfDate || stmt.date;
    if (!date) return;
    
    const existing = statementsMap.get(date) || { date };
    statementsMap.set(date, {
      ...existing,
      totalAssets: stmt.TotalAssets,
      totalLiabilities: stmt.TotalLiabilitiesNetMinorityInterest,
      equity: stmt.StockholdersEquity,
      cash: stmt.CashAndCashEquivalents,
      totalDebt: stmt.TotalDebt,
    });
  });
  
  cashFlow.forEach((stmt: any) => {
    const date = stmt.asOfDate || stmt.date;
    if (!date) return;
    
    const existing = statementsMap.get(date) || { date };
    statementsMap.set(date, {
      ...existing,
      operatingCashFlow: stmt.OperatingCashFlow,
      investingCashFlow: stmt.InvestingCashFlow,
      financingCashFlow: stmt.FinancingCashFlow,
      freeCashFlow: stmt.FreeCashFlow,
    });
  });
  
  const statements = Array.from(statementsMap.values())
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  
  return { statements };
}

async function fetchDividends(ticker: string) {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = Math.floor(new Date().setFullYear(new Date().getFullYear() - 5) / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const events = data.chart?.result?.[0]?.events?.dividends || {};
  
  const dividends = Object.values(events).map((div: any) => ({
    date: new Date(div.date * 1000).toISOString(),
    amount: div.amount,
  }));
  
  return { dividends };
}

async function fetchSplits(ticker: string) {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = Math.floor(new Date().setFullYear(new Date().getFullYear() - 10) / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=split`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const events = data.chart?.result?.[0]?.events?.splits || {};
  
  const splits = Object.values(events).map((split: any) => ({
    date: new Date(split.date * 1000).toISOString(),
    numerator: split.numerator,
    denominator: split.denominator,
    ratio: `${split.numerator}:${split.denominator}`,
  }));
  
  return { splits };
}

async function fetchHolders(ticker: string) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=majorHoldersBreakdown,institutionOwnership`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const result = data.quoteSummary?.result?.[0];
  
  if (!result) {
    return { majorHolders: {}, institutionalHolders: [] };
  }
  
  const majorHolders = result.majorHoldersBreakdown || {};
  const institutionalOwnership = result.institutionOwnership?.ownershipList || [];
  
  const institutionalHolders = institutionalOwnership.slice(0, 10).map((holder: any) => ({
    organization: holder.organization,
    pctHeld: holder.pctHeld?.raw,
    position: holder.position?.raw,
    value: holder.value?.raw,
  }));
  
  return { 
    majorHolders: {
      insidersPercentHeld: majorHolders.insidersPercentHeld?.raw,
      institutionsPercentHeld: majorHolders.institutionsPercentHeld?.raw,
    },
    institutionalHolders 
  };
}
