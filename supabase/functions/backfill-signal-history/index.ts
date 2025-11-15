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
    const { startDate, endDate, days = 180 } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Backfilling signals for ${days} days (${startDate} to ${endDate})`);

    const allSignals: SignalRecord[] = [];

    // Fetch historical data for each signal type
    for (const signalType of SIGNAL_TYPES) {
      try {
        const functionName = SIGNAL_FUNCTION_MAP[signalType];
        console.log(`Backfilling ${signalType} from ${functionName}...`);

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { days }
        });

        if (error) {
          console.error(`Error fetching ${signalType}:`, error);
          continue;
        }

        // Transform signal data based on type
        const signals = transformHistoricalSignalData(signalType, data, startDate, endDate);
        allSignals.push(...signals);
        
        console.log(`Backfilled ${signals.length} ${signalType} signals`);
      } catch (err) {
        console.error(`Error processing ${signalType}:`, err);
      }
    }

    // Insert signals in batches to avoid timeouts
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < allSignals.length; i += batchSize) {
      const batch = allSignals.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('signal_history')
        .upsert(batch, {
          onConflict: 'date,ticker,signal_type',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Error inserting batch:', insertError);
      } else {
        inserted += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${inserted}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        startDate,
        endDate,
        totalSignals: allSignals.length,
        inserted,
        breakdown: SIGNAL_TYPES.reduce((acc, type) => {
          acc[type] = allSignals.filter(s => s.signal_type === type).length;
          return acc;
        }, {} as Record<string, number>)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-signal-history:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function transformHistoricalSignalData(
  signalType: string, 
  data: any, 
  startDate: string, 
  endDate: string
): SignalRecord[] {
  const signals: SignalRecord[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (signalType) {
    case 'abnormal_volume':
      if (data.volumeData && Array.isArray(data.volumeData)) {
        // Abnormal volume only has current data, map to latest date in range
        const latestDate = endDate;
        data.volumeData.forEach((item: any) => {
          if (item.status === 'Abnormal' || item.status === 'Moderate') {
            signals.push({
              date: latestDate,
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
        data.larsTimeSeries.forEach((item: any) => {
          const itemDate = new Date(item.date);
          if (itemDate >= start && itemDate <= end) {
            signals.push({
              date: item.date,
              ticker: 'PORTFOLIO',
              signal_type: signalType,
              signal_value: item.lars,
              metadata: {
                interpretation: item.interpretation
              }
            });
          }
        });
      }
      break;

    case 'rotation':
      if (data.rotationTimeSeries && Array.isArray(data.rotationTimeSeries)) {
        data.rotationTimeSeries.forEach((item: any) => {
          const itemDate = new Date(item.date);
          if (itemDate >= start && itemDate <= end) {
            signals.push({
              date: item.date,
              ticker: 'PORTFOLIO',
              signal_type: signalType,
              signal_value: item.rotationScore,
              metadata: {
                marketRegime: item.marketRegime
              }
            });
          }
        });
      }
      break;

    case 'ssi':
      if (data.ssiTimeSeries && Array.isArray(data.ssiTimeSeries)) {
        data.ssiTimeSeries.forEach((item: any) => {
          const itemDate = new Date(item.date);
          if (itemDate >= start && itemDate <= end && item.sectors) {
            Object.entries(item.sectors).forEach(([sector, value]) => {
              signals.push({
                date: item.date,
                ticker: sector,
                signal_type: signalType,
                signal_value: value as number,
                metadata: {
                  sector
                }
              });
            });
          }
        });
      }
      break;

    case 'vdi':
      if (data.vdiTimeSeries && Array.isArray(data.vdiTimeSeries)) {
        data.vdiTimeSeries.forEach((item: any) => {
          const itemDate = new Date(item.date);
          if (itemDate >= start && itemDate <= end) {
            signals.push({
              date: item.date,
              ticker: 'PORTFOLIO',
              signal_type: signalType,
              signal_value: item.vdi,
              metadata: {
                divergenceScore: item.divergenceScore
              }
            });
          }
        });
      }
      break;

    case 'alpha_engine':
      // Alpha engine returns scores per ticker, map to latest date
      if (data.alphaScores && Array.isArray(data.alphaScores)) {
        const latestDate = endDate;
        data.alphaScores.forEach((item: any) => {
          if (item.alphaScore !== undefined) {
            signals.push({
              date: latestDate,
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
      // Outlier radar returns current outliers, map to latest date
      if (data.outliers && Array.isArray(data.outliers)) {
        const latestDate = endDate;
        data.outliers.forEach((item: any) => {
          signals.push({
            date: latestDate,
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
