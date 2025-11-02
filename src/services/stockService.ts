import { Bank, BankData, VolumeAlert, PriceAlert, FinancialStatement } from '@/types/bank';

// Helper function to calculate percentage change
const calculateChange = (current: number, previous: number): number => {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// Get start of year
const getYearStart = (): Date => {
  const date = new Date();
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

interface YahooQuote {
  date: number;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// Fetch data from Yahoo Finance API with CORS proxy
const fetchYahooData = async (ticker: string): Promise<YahooQuote[]> => {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = Math.floor(new Date().setFullYear(new Date().getFullYear() - 1) / 1000);
  
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  const url = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.chart?.result?.[0]) {
    throw new Error('No data received');
  }
  
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  
  const closes = quotes.close || [];
  const opens = quotes.open || [];
  const highs = quotes.high || [];
  const lows = quotes.low || [];
  const volumes = quotes.volume || [];
  
  return timestamps.map((timestamp: number, index: number) => ({
    date: timestamp * 1000,
    close: closes[index] || 0,
    open: opens[index] || 0,
    high: highs[index] || 0,
    low: lows[index] || 0,
    volume: volumes[index] || 0,
  })).filter((q: YahooQuote) => q.close > 0);
};

// Fetch data for a single bank with retry logic
const fetchBankData = async (bank: Bank, retries = 3): Promise<BankData | null> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add delay between requests to avoid rate limiting
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      const quotes = await fetchYahooData(bank.ticker);

      if (!quotes || quotes.length === 0) {
        console.warn(`No data received for ${bank.ticker} on attempt ${attempt + 1}`);
        continue;
      }

      // Get current price (last close)
      const currentPrice = quotes[quotes.length - 1].close;

      // Calculate today's change (last vs second-to-last)
      const todayChange = quotes.length >= 2 
        ? calculateChange(quotes[quotes.length - 1].close, quotes[quotes.length - 2].close)
        : 0;

      // Calculate 1-month change (30 trading days)
      const monthIndex = Math.max(0, quotes.length - 30);
      const monthChange = calculateChange(currentPrice, quotes[monthIndex].close);

      // Calculate YTD change
      const yearStart = getYearStart();
      const ytdQuote = quotes.find(q => new Date(q.date) >= yearStart);
      const ytdChange = ytdQuote ? calculateChange(currentPrice, ytdQuote.close) : 0;

      // Calculate 1-year change (252 trading days)
      const yearIndex = Math.max(0, quotes.length - 252);
      const yearChange = calculateChange(currentPrice, quotes[yearIndex].close);

      // Calculate volume alert (last 30 days)
      const volumeAlert = calculateVolumeAlert(quotes);

      // Calculate price alert (6 months)
      const priceAlert = calculatePriceAlert(quotes);

      return {
        ...bank,
        currentPrice,
        todayChange,
        monthChange,
        ytdChange,
        yearChange,
        volumeAlert,
        priceAlert,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching ${bank.ticker} (attempt ${attempt + 1}):`, error);
      if (attempt === retries - 1) {
        return null;
      }
    }
  }
  return null;
};

// Fetch all banks data with sequential processing to avoid rate limiting
export const fetchAllBanksData = async (
  banks: Bank[],
  onProgress?: (completed: number, total: number) => void
): Promise<BankData[]> => {
  const results: BankData[] = [];
  
  for (let i = 0; i < banks.length; i++) {
    const bankData = await fetchBankData(banks[i]);
    if (bankData) {
      results.push(bankData);
    }
    
    if (onProgress) {
      onProgress(i + 1, banks.length);
    }
    
    // Add small delay between each request
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
};

// Fetch weekly historical data for a bank
export const fetchWeeklyData = async (ticker: string, period: 'month' | 'ytd' | 'year'): Promise<{ date: string; price: number }[]> => {
  const endDate = Math.floor(Date.now() / 1000);
  let startDate: number;
  
  switch (period) {
    case 'month':
      startDate = Math.floor(new Date().setDate(new Date().getDate() - 30) / 1000);
      break;
    case 'ytd':
      const yearStart = new Date();
      yearStart.setMonth(0, 1);
      yearStart.setHours(0, 0, 0, 0);
      startDate = Math.floor(yearStart.getTime() / 1000);
      break;
    case 'year':
      startDate = Math.floor(new Date().setFullYear(new Date().getFullYear() - 1) / 1000);
      break;
  }
  
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1wk`;
  const url = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data received');
  
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  
  return timestamps.map((timestamp: number, index: number) => ({
    date: new Date(timestamp * 1000).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }),
    price: closes[index] || 0
  })).filter((d: any) => d.price > 0);
};

// Calculate volume alert based on last 30 days
const calculateVolumeAlert = (quotes: YahooQuote[]): VolumeAlert | undefined => {
  if (quotes.length < 30) return undefined;

  const last30Days = quotes.slice(-30);
  const volumes = last30Days.map(q => q.volume);
  
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
  const stdDev = Math.sqrt(variance);
  
  const currentVolume = quotes[quotes.length - 1].volume;
  const deviations = (currentVolume - avgVolume) / stdDev;
  
  let severity: 'normal' | 'warning' | 'high' = 'normal';
  if (deviations > 2) severity = 'high';
  else if (deviations > 1) severity = 'warning';
  
  return {
    currentVolume,
    avgVolume,
    stdDev,
    deviations,
    severity
  };
};

// Calculate price alert based on 6 months high/low
const calculatePriceAlert = (quotes: YahooQuote[]): PriceAlert | undefined => {
  if (quotes.length < 126) return undefined; // ~6 months of trading days
  
  const last6Months = quotes.slice(-126);
  const currentPrice = quotes[quotes.length - 1].close;
  
  const prices = last6Months.map(q => q.close);
  const highPrice = Math.max(...prices);
  const lowPrice = Math.min(...prices);
  
  const tolerance = 0.02; // 2% tolerance
  
  // Check if near 6-month high
  if (currentPrice >= highPrice * (1 - tolerance)) {
    const changePercent = ((currentPrice - lowPrice) / lowPrice) * 100;
    return {
      type: 'high',
      message: `Høyeste på 6 måneder`,
      changePercent
    };
  }
  
  // Check if near 6-month low
  if (currentPrice <= lowPrice * (1 + tolerance)) {
    const changePercent = ((currentPrice - highPrice) / highPrice) * 100;
    return {
      type: 'low',
      message: `Nærmer seg laveste siden ${new Date(last6Months[0].date).toLocaleDateString('nb-NO', { month: 'long' })}`,
      changePercent
    };
  }
  
  return undefined;
};

// Fetch financial statements (annual or quarterly)
export const fetchFinancialStatements = async (
  ticker: string, 
  period: 'annual' | 'quarterly'
): Promise<FinancialStatement[]> => {
  try {
    const yahooUrl = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}?type=annualTotalRevenue,annualNetIncome,annualTotalAssets,annualTotalLiabilitiesNetMinorityInterest,annualStockholdersEquity,annualBasicEPS,annualOperatingIncome,quarterlyTotalRevenue,quarterlyNetIncome,quarterlyTotalAssets,quarterlyTotalLiabilitiesNetMinorityInterest,quarterlyStockholdersEquity,quarterlyBasicEPS,quarterlyOperatingIncome`;
    const url = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const timeseries = data.timeseries?.result || [];
    
    const statements: Map<string, Partial<FinancialStatement>> = new Map();
    
    timeseries.forEach((series: any) => {
      const seriesData = series[Object.keys(series)[0]];
      if (!seriesData || !Array.isArray(seriesData)) return;
      
      const prefix = period === 'annual' ? 'annual' : 'quarterly';
      const metaKey = series.meta?.type?.[0];
      
      if (!metaKey?.startsWith(prefix)) return;
      
      seriesData.forEach((item: any) => {
        if (!item.asOfDate || !item.reportedValue?.raw) return;
        
        const date = item.asOfDate;
        if (!statements.has(date)) {
          statements.set(date, { date });
        }
        
        const stmt = statements.get(date)!;
        const value = item.reportedValue.raw;
        
        if (metaKey.includes('TotalRevenue')) stmt.revenue = value;
        else if (metaKey.includes('NetIncome')) stmt.netIncome = value;
        else if (metaKey.includes('TotalAssets')) stmt.totalAssets = value;
        else if (metaKey.includes('TotalLiabilities')) stmt.totalLiabilities = value;
        else if (metaKey.includes('StockholdersEquity')) stmt.equity = value;
        else if (metaKey.includes('BasicEPS')) stmt.eps = value;
        else if (metaKey.includes('OperatingIncome')) stmt.operatingIncome = value;
      });
    });
    
    return Array.from(statements.values())
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
      .slice(0, 8) as FinancialStatement[];
      
  } catch (error) {
    console.error('Error fetching financial statements:', error);
    return [];
  }
};
