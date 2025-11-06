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

  // Use apidojo Yahoo Finance API
  const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-financials?symbol=${ticker}&region=US`;
  
  console.log(`Fetching financials from apidojo for ${ticker}`);
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('RapidAPI error response:', errorText);
    throw new Error(`RapidAPI error: ${response.status} - ${errorText}`);
  }
  
  const responseText = await response.text();
  console.log('RapidAPI response text:', responseText.substring(0, 200)); // Log first 200 chars
  
  if (!responseText || responseText.trim() === '') {
    console.error('Empty response from RapidAPI');
    throw new Error('Empty response from RapidAPI');
  }
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
    console.error('Response text:', responseText);
    throw new Error('Invalid JSON response from RapidAPI');
  }
  
  if (!data || !data.incomeStatementHistory) {
    console.warn('No financial data found in response');
    return { statements: [] };
  }
  
  // Choose between annual and quarterly
  const incomeKey = period === 'annual' ? 'incomeStatementHistory' : 'incomeStatementHistoryQuarterly';
  const balanceKey = period === 'annual' ? 'balanceSheetHistory' : 'balanceSheetHistoryQuarterly';
  const cashflowKey = period === 'annual' ? 'cashflowStatementHistory' : 'cashflowStatementHistoryQuarterly';
  
  const incomeStatements = data[incomeKey]?.incomeStatementHistory || [];
  const balanceSheets = data[balanceKey]?.balanceSheetStatements || [];
  const cashflowStatements = data[cashflowKey]?.cashflowStatements || [];
  
  console.log(`Found ${incomeStatements.length} income statements, ${balanceSheets.length} balance sheets`);
  
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
  const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }

  const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-timeseries?symbol=${ticker}&region=US`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }
  
  const data = await response.json();
  const timeseries = data.timeseries?.result || [];
  
  const dividends: any[] = [];
  
  timeseries.forEach((series: any) => {
    if (series.meta?.type?.[0] === 'dividend') {
      const divData = series.dividend || [];
      divData.forEach((div: any) => {
        if (div.amount && div.date) {
          dividends.push({
            date: new Date(div.date * 1000).toISOString(),
            amount: div.amount,
          });
        }
      });
    }
  });
  
  return { dividends };
}

async function fetchSplits(ticker: string) {
  const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }

  const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-timeseries?symbol=${ticker}&region=US`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }
  
  const data = await response.json();
  const timeseries = data.timeseries?.result || [];
  
  const splits: any[] = [];
  
  timeseries.forEach((series: any) => {
    if (series.meta?.type?.[0] === 'split') {
      const splitData = series.splits || [];
      splitData.forEach((split: any) => {
        if (split.date && split.numerator && split.denominator) {
          splits.push({
            date: new Date(split.date * 1000).toISOString(),
            numerator: split.numerator,
            denominator: split.denominator,
            ratio: `${split.numerator}:${split.denominator}`,
          });
        }
      });
    }
  });
  
  return { splits };
}

async function fetchHolders(ticker: string) {
  const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }

  const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-holders?symbol=${ticker}&region=US`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }
  
  const data = await response.json();
  
  const majorHolders = {
    insidersPercentHeld: data.majorHoldersBreakdown?.insidersPercentHeld?.raw,
    institutionsPercentHeld: data.majorHoldersBreakdown?.institutionsPercentHeld?.raw,
  };
  
  const institutionalHolders = (data.institutionOwnership?.ownershipList || [])
    .slice(0, 10)
    .map((holder: any) => ({
      organization: holder.organization,
      pctHeld: holder.pctHeld?.raw,
      position: holder.position?.raw,
      value: holder.value?.raw,
    }));
  
  return { majorHolders, institutionalHolders };
}
