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

async function fetchVolumeData(ticker: string, days: number) {
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
  
  const volumes = result.indicators.quote[0].volume;
  
  return volumes.filter((v: number | null) => v !== null && v > 0);
}

function calculateStats(volumes: number[]) {
  const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const squaredDiffs = volumes.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / volumes.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev };
}

function calculateZScore(currentVolume: number, mean: number, stdDev: number) {
  if (stdDev === 0) return 0;
  return (currentVolume - mean) / stdDev;
}

function classifyStatus(zScore: number): 'Normal' | 'Moderate' | 'Abnormal' {
  const absZ = Math.abs(zScore);
  if (absZ >= 2) return 'Abnormal';
  if (absZ >= 1) return 'Moderate';
  return 'Normal';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { days = 60 } = await req.json();
    
    // Fetch volume data for all banks
    const volumePromises = BANKS.map(bank => 
      fetchVolumeData(bank.ticker, days)
        .then(volumes => ({ 
          ticker: bank.ticker, 
          name: bank.name, 
          volumes 
        }))
        .catch(err => {
          console.error(`Error fetching ${bank.ticker}:`, err);
          return null;
        })
    );
    
    const volumeResults = await Promise.all(volumePromises);
    const validVolumes = volumeResults.filter((r): r is { ticker: string; name: string; volumes: number[] } => 
      r !== null && r.volumes.length > 30
    );
    
    // Calculate statistics for each bank
    const volumeData = validVolumes.map(({ ticker, name, volumes }) => {
      // Use last 30 days for baseline
      const last30Days = volumes.slice(-30);
      const currentVolume = volumes[volumes.length - 1];
      
      const { mean: avgVolume, stdDev } = calculateStats(last30Days);
      const zScore = calculateZScore(currentVolume, avgVolume, stdDev);
      const status = classifyStatus(zScore);
      
      return {
        ticker,
        name,
        currentVolume,
        avgVolume,
        zScore,
        status
      };
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        volumeData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error calculating abnormal volume:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
