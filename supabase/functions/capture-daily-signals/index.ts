import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNAL_TYPES = [
  'abnormal_volume',
  'lars',
  'rotation',
  'ssi',
  'vdi',
  'alpha_engine',
  'outlier_radar'
] as const;

const SIGNAL_FUNCTION_MAP: Record<string, string> = {
  'abnormal_volume': 'calculate-abnormal-volume',
  'lars': 'calculate-lars',
  'rotation': 'calculate-rotation',
  'ssi': 'calculate-ssi',
  'vdi': 'calculate-vdi',
  'alpha_engine': 'calculate-alpha-engine',
  'outlier_radar': 'calculate-outlier-radar'
};

interface SignalRecord {
  date: string;
  ticker: string;
  signal_type: string;
  signal_value: number;
  metadata: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const signalsToInsert: SignalRecord[] = [];

    console.log(`Capturing signals for date: ${today}`);

    // Fetch all signal types
    for (const signalType of SIGNAL_TYPES) {
      try {
        const functionName = SIGNAL_FUNCTION_MAP[signalType];
        console.log(`Fetching ${signalType} from ${functionName}...`);

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { days: 1 }
        });

        if (error) {
          console.error(`Error fetching ${signalType}:`, error);
          continue;
        }

        // Transform signal data based on type
        const signals = transformSignalData(signalType, data, today);
        signalsToInsert.push(...signals);
        
        console.log(`Captured ${signals.length} ${signalType} signals`);
      } catch (err) {
        console.error(`Error processing ${signalType}:`, err);
      }
    }

    // Insert signals into database
    if (signalsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('signal_history')
        .upsert(signalsToInsert, {
          onConflict: 'date,ticker,signal_type',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('Error inserting signals:', insertError);
        throw insertError;
      }

      console.log(`Successfully inserted ${signalsToInsert.length} signals`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        signalsCaptured: signalsToInsert.length,
        breakdown: SIGNAL_TYPES.reduce((acc, type) => {
          acc[type] = signalsToInsert.filter(s => s.signal_type === type).length;
          return acc;
        }, {} as Record<string, number>)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in capture-daily-signals:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function transformSignalData(signalType: string, data: any, date: string): SignalRecord[] {
  const signals: SignalRecord[] = [];

  switch (signalType) {
    case 'abnormal_volume':
      if (data.volumeData && Array.isArray(data.volumeData)) {
        data.volumeData.forEach((item: any) => {
          if (item.status === 'Abnormal' || item.status === 'Moderate') {
            signals.push({
              date,
              ticker: item.ticker,
              signal_type: signalType,
              signal_value: item.zScore,
              metadata: {
                status: item.status,
                currentVolume: item.currentVolume,
                averageVolume: item.averageVolume
              }
            });
          }
        });
      }
      break;

    case 'lars':
      if (data.larsTimeSeries && Array.isArray(data.larsTimeSeries)) {
        const latestData = data.larsTimeSeries[data.larsTimeSeries.length - 1];
        if (latestData && latestData.date === date) {
          // LARS is portfolio-wide, use 'PORTFOLIO' as ticker
          signals.push({
            date,
            ticker: 'PORTFOLIO',
            signal_type: signalType,
            signal_value: latestData.lars,
            metadata: {
              interpretation: latestData.interpretation
            }
          });
        }
      }
      break;

    case 'rotation':
      if (data.rotationTimeSeries && Array.isArray(data.rotationTimeSeries)) {
        const latestData = data.rotationTimeSeries[data.rotationTimeSeries.length - 1];
        if (latestData && latestData.date === date) {
          signals.push({
            date,
            ticker: 'PORTFOLIO',
            signal_type: signalType,
            signal_value: latestData.rotationScore,
            metadata: {
              marketRegime: latestData.marketRegime
            }
          });
        }
      }
      break;

    case 'ssi':
      if (data.ssiTimeSeries && Array.isArray(data.ssiTimeSeries)) {
        const latestData = data.ssiTimeSeries[data.ssiTimeSeries.length - 1];
        if (latestData && latestData.date === date && latestData.sectors) {
          Object.entries(latestData.sectors).forEach(([sector, value]) => {
            signals.push({
              date,
              ticker: sector,
              signal_type: signalType,
              signal_value: value as number,
              metadata: {
                sector
              }
            });
          });
        }
      }
      break;

    case 'vdi':
      if (data.vdiTimeSeries && Array.isArray(data.vdiTimeSeries)) {
        const latestData = data.vdiTimeSeries[data.vdiTimeSeries.length - 1];
        if (latestData && latestData.date === date) {
          signals.push({
            date,
            ticker: 'PORTFOLIO',
            signal_type: signalType,
            signal_value: latestData.vdi,
            metadata: {
              divergenceScore: latestData.divergenceScore
            }
          });
        }
      }
      break;

    case 'alpha_engine':
      if (data.alphaScores && Array.isArray(data.alphaScores)) {
        data.alphaScores.forEach((item: any) => {
          if (item.alphaScore !== undefined) {
            signals.push({
              date,
              ticker: item.ticker,
              signal_type: signalType,
              signal_value: item.alphaScore,
              metadata: {
                name: item.name,
                category: item.category
              }
            });
          }
        });
      }
      break;

    case 'outlier_radar':
      if (data.outliers && Array.isArray(data.outliers)) {
        data.outliers.forEach((item: any) => {
          signals.push({
            date,
            ticker: item.ticker,
            signal_type: signalType,
            signal_value: item.outlierScore,
            metadata: {
              name: item.name,
              type: item.type
            }
          });
        });
      }
      break;
  }

  return signals;
}
