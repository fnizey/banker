import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TICKERS = [
  "SB1NO.OL", "SBNOR.OL", "MING.OL", "SPOL.OL", "NONG.OL", "MORG.OL",
  "SPOG.OL", "HELG.OL", "ROGS.OL", "RING.OL", "SOAG.OL", "SNOR.OL",
  "HGSB.OL", "JAREN.OL", "AURG.OL", "SKUE.OL", "MELG.OL", "SOGN.OL",
  "HSPG.OL", "VVL.OL", "BIEN.OL", "DNB.OL"
];


async function fetchYahooData(ticker: string, startDate: number, endDate: number) {
  const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  
  console.log(`📡 Fetching ${ticker} from Yahoo Finance API`);
  
  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance error for ${ticker}: ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  
  if (!result) {
    throw new Error(`No data for ${ticker}`);
  }

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  const data: { date: string; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      data.push({
        date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
        close: closes[i],
      });
    }
  }

  console.log(`✅ Fetched ${data.length} data points for ${ticker}`);
  return data;
}

function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema.push(sum / period);
  
  // Calculate subsequent EMAs
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  
  return ema;
}

function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  // MACD line starts from index 14 (26 - 12)
  const macdLine: number[] = [];
  for (let i = 14; i < ema12.length; i++) {
    macdLine.push(ema12[i] - ema26[i - 14]);
  }
  
  // Signal line is 9-day EMA of MACD line
  const signalLine = calculateEMA(macdLine, 9);
  
  // Histogram is MACD - Signal
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + 8] - signalLine[i]);
  }
  
  return {
    macd: macdLine[macdLine.length - 1] || 0,
    signal: signalLine[signalLine.length - 1] || 0,
    histogram: histogram[histogram.length - 1] || 0,
  };
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate smoothed averages
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Momentum calculation started');
    const body = await req.json();
    const { days = 180 } = body;
    console.log(`Requested days: ${days}`);
    
    // Fetch extra data for MA200 calculation (need at least 200 days + requested period)
    const daysToFetch = Math.max(days + 200, 400);
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (daysToFetch * 24 * 60 * 60);

    const results = await Promise.all(
      TICKERS.map(async (ticker) => {
        try {
          const data = await fetchYahooData(ticker, startDate, endDate);
          
          if (data.length < 50) {
            console.log(`Insufficient data for ${ticker}`);
            return null;
          }

          const prices = data.map((d) => d.close);
          const currentPrice = prices[prices.length - 1];

          // Calculate indicators
          const macdData = calculateMACD(prices);
          const rsi = calculateRSI(prices);
          const ma50 = calculateSMA(prices, 50);
          const ma200 = calculateSMA(prices, 200);
          
          // Golden Cross percentage: (MA50 - MA200) / MA200 * 100
          const goldenCross = ma200 > 0 ? ((ma50 - ma200) / ma200) * 100 : 0;

          return {
            ticker,
            name: ticker,
            macd: macdData.macd,
            macd_signal: macdData.signal,
            macd_histogram: macdData.histogram,
            rsi,
            ma50,
            ma200,
            current_price: currentPrice,
            golden_cross: goldenCross,
          };
        } catch (error) {
          console.error(`Error processing ${ticker}:`, error);
          return null;
        }
      })
    );

    const momentum = results.filter((r) => r !== null);

    console.log(`Calculated momentum for ${momentum.length} banks`);

    return new Response(JSON.stringify({ success: true, momentum }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Momentum calculation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
