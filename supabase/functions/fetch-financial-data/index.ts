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
  const modules = period === 'annual' 
    ? 'incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory'
    : 'incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly';
  
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const result = data.quoteSummary?.result?.[0];
  
  if (!result) {
    return { statements: [] };
  }
  
  const incomeKey = period === 'annual' ? 'incomeStatementHistory' : 'incomeStatementHistoryQuarterly';
  const balanceKey = period === 'annual' ? 'balanceSheetHistory' : 'balanceSheetHistoryQuarterly';
  const cashflowKey = period === 'annual' ? 'cashflowStatementHistory' : 'cashflowStatementHistoryQuarterly';
  
  const incomeStatements = result[incomeKey]?.incomeStatementHistory || [];
  const balanceSheets = result[balanceKey]?.balanceSheetStatements || [];
  const cashflowStatements = result[cashflowKey]?.cashflowStatements || [];
  
  // Combine all data by date
  const statementsMap = new Map();
  
  incomeStatements.forEach((stmt: any) => {
    const date = stmt.endDate?.fmt;
    if (!date) return;
    
    statementsMap.set(date, {
      date,
      revenue: stmt.totalRevenue?.raw,
      netIncome: stmt.netIncome?.raw,
      operatingIncome: stmt.operatingIncome?.raw,
      grossProfit: stmt.grossProfit?.raw,
      eps: stmt.basicEPS?.raw,
      ebitda: stmt.ebitda?.raw,
    });
  });
  
  balanceSheets.forEach((stmt: any) => {
    const date = stmt.endDate?.fmt;
    if (!date) return;
    
    const existing = statementsMap.get(date) || { date };
    statementsMap.set(date, {
      ...existing,
      totalAssets: stmt.totalAssets?.raw,
      totalLiabilities: stmt.totalLiab?.raw,
      equity: stmt.totalStockholderEquity?.raw,
      cash: stmt.cash?.raw,
      totalDebt: stmt.totalDebt?.raw,
    });
  });
  
  cashflowStatements.forEach((stmt: any) => {
    const date = stmt.endDate?.fmt;
    if (!date) return;
    
    const existing = statementsMap.get(date) || { date };
    statementsMap.set(date, {
      ...existing,
      operatingCashFlow: stmt.totalCashFromOperatingActivities?.raw,
      investingCashFlow: stmt.totalCashflowsFromInvestingActivities?.raw,
      financingCashFlow: stmt.totalCashFromFinancingActivities?.raw,
      freeCashFlow: stmt.freeCashFlow?.raw,
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
  
  const response = await fetch(url);
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
  
  const response = await fetch(url);
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
  
  const response = await fetch(url);
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
