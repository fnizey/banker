import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VDIData {
  date: string;
  vdi: number;
}

interface LARSData {
  date: string;
  lars: number;
}

interface RotationData {
  date: string;
  rotationScore: number;
}

function calculateZScore(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(val => (val - mean) / stdDev);
}

async function fetchVDIData(days: number): Promise<VDIData[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const url = `${supabaseUrl}/functions/v1/calculate-vdi`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch VDI data');
  
  const data = await response.json();
  return data.vdiTimeSeries.map((d: any) => ({
    date: d.date,
    vdi: d.vdi,
  }));
}

async function fetchLARSData(days: number): Promise<LARSData[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const url = `${supabaseUrl}/functions/v1/calculate-lars`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch LARS data');
  
  const data = await response.json();
  return data.larsTimeSeries.map((d: any) => ({
    date: d.date,
    lars: d.lars,
  }));
}

async function fetchRotationData(days: number): Promise<RotationData[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const url = `${supabaseUrl}/functions/v1/calculate-rotation`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch rotation data');
  
  const data = await response.json();
  return data.rotationTimeSeries.map((d: any) => ({
    date: d.date,
    rotationScore: d.cumulativeRotation,
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting SMFI calculation...');
    
    const { days = 90 } = await req.json().catch(() => ({}));

    // Fetch all required data in parallel
    const [vdiData, larsData, rotationData] = await Promise.all([
      fetchVDIData(days),
      fetchLARSData(days),
      fetchRotationData(days),
    ]);

    console.log(`Fetched VDI: ${vdiData.length}, LARS: ${larsData.length}, Rotation: ${rotationData.length} records`);

    // Find common dates
    const vdiDates = new Set(vdiData.map(d => d.date));
    const larsDates = new Set(larsData.map(d => d.date));
    const rotationDates = new Set(rotationData.map(d => d.date));
    
    const commonDates = Array.from(vdiDates)
      .filter(date => larsDates.has(date) && rotationDates.has(date))
      .sort();

    console.log(`Found ${commonDates.length} common dates`);

    if (commonDates.length === 0) {
      throw new Error('No common dates found across all datasets');
    }

    // Extract values for common dates
    const vdiValues = commonDates.map(date => vdiData.find(d => d.date === date)!.vdi);
    const larsValues = commonDates.map(date => larsData.find(d => d.date === date)!.lars);
    const rotationValues = commonDates.map(date => rotationData.find(d => d.date === date)!.rotationScore);

    // Calculate z-scores
    const vdiZScores = calculateZScore(vdiValues);
    const larsZScores = calculateZScore(larsValues);
    const rotationZScores = calculateZScore(rotationValues);

    // Calculate SMFI: z(rotation) + z(VDI) - z(LARS)
    const smfiTimeSeries = commonDates.map((date, i) => {
      const smfi = rotationZScores[i] + vdiZScores[i] - larsZScores[i];
      
      return {
        date,
        smfi,
        rotationZScore: rotationZScores[i],
        vdiZScore: vdiZScores[i],
        larsZScore: larsZScores[i],
      };
    });

    // Calculate SMFI statistics
    const smfiValues = smfiTimeSeries.map(d => d.smfi);
    const smfiMean = smfiValues.reduce((a, b) => a + b, 0) / smfiValues.length;
    const smfiVariance = smfiValues.reduce((sum, val) => sum + Math.pow(val - smfiMean, 2), 0) / smfiValues.length;
    const smfiStdDev = Math.sqrt(smfiVariance);

    const currentSMFI = smfiTimeSeries[smfiTimeSeries.length - 1];
    const weekAgoSMFI = smfiTimeSeries[Math.max(0, smfiTimeSeries.length - 7)];
    const sevenDayChange = currentSMFI.smfi - weekAgoSMFI.smfi;

    // Determine sentiment
    let sentiment = 'Nøytral';
    if (currentSMFI.smfi > smfiStdDev) {
      sentiment = 'Risk-off (Defensiv)';
    } else if (currentSMFI.smfi < -smfiStdDev) {
      sentiment = 'Risk-on (Offensiv)';
    }

    console.log('SMFI calculation completed successfully');

    return new Response(
      JSON.stringify({
        smfiTimeSeries: smfiTimeSeries.slice(-days),
        currentSMFI: currentSMFI || null,
        sevenDayChange,
        sentiment,
        statistics: {
          mean: smfiMean,
          stdDev: smfiStdDev,
          upperBand: smfiMean + smfiStdDev,
          lowerBand: smfiMean - smfiStdDev,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in SMFI calculation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
