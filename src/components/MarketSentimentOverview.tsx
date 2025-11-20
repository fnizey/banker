import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketSentiment {
  overall: 'Risk-on' | 'Neutral' | 'Risk-off';
  overallScore: number; // 0-100
  indicators: {
    ssi: { value: number; sentiment: string; };
    smfi: { value: number; sentiment: string; };
    vdi: { value: number; };
    lars: { value: number; };
  };
  alerts: Array<{ type: 'positive' | 'negative' | 'neutral'; message: string; }>;
}

export const MarketSentimentOverview = () => {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketSentiment();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketSentiment, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarketSentiment = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching market sentiment data...');
      
      const [ssiRes, smfiRes, vdiRes, larsRes] = await Promise.all([
        supabase.functions.invoke('calculate-ssi', { body: { days: 30 } }),
        supabase.functions.invoke('calculate-smfi', { body: { days: 30 } }),
        supabase.functions.invoke('calculate-vdi', { body: { days: 30 } }),
        supabase.functions.invoke('calculate-lars', { body: { days: 30 } }),
      ]);

      console.log('📊 SSI Response:', ssiRes);
      console.log('📊 SMFI Response:', smfiRes);
      console.log('📊 VDI Response:', vdiRes);
      console.log('📊 LARS Response:', larsRes);

      // Check for errors
      if (ssiRes.error) {
        console.error('❌ SSI Error:', ssiRes.error);
        throw new Error(`SSI: ${ssiRes.error.message}`);
      }
      if (smfiRes.error) {
        console.error('❌ SMFI Error:', smfiRes.error);
        throw new Error(`SMFI: ${smfiRes.error.message}`);
      }
      if (vdiRes.error) {
        console.error('❌ VDI Error:', vdiRes.error);
        throw new Error(`VDI: ${vdiRes.error.message}`);
      }
      if (larsRes.error) {
        console.error('❌ LARS Error:', larsRes.error);
        throw new Error(`LARS: ${larsRes.error.message}`);
      }

      // Extract latest values - NO FALLBACKS, must have real data
      const ssiData = ssiRes.data?.currentSSI?.ssiEMA;
      const ssiSentiment = ssiRes.data?.sentiment;
      const smfiData = smfiRes.data?.currentSMFI?.smfi;
      const smfiSentiment = smfiRes.data?.sentiment;
      const vdiData = vdiRes.data?.currentVDI?.vdi;
      const larsData = larsRes.data?.currentLARS?.lars;

      console.log('✅ Extracted values:', { ssiData, smfiData, vdiData, larsData });

      if (ssiData === undefined || smfiData === undefined || vdiData === undefined || larsData === undefined) {
        throw new Error('Missing indicator data - one or more indicators returned undefined');
      }

      // Calculate overall sentiment score (0-100) based on real indicators
      // SSI: negative = bullish, positive = bearish
      const ssiNorm = Math.max(0, Math.min(100, 50 - ssiData * 10));
      
      // SMFI: negative = risk-on (small bank flow), positive = risk-off
      const smfiNorm = Math.max(0, Math.min(100, 50 - smfiData * 5));
      
      // VDI: < 1 = normal, > 1 = stress in small banks
      const vdiNorm = Math.max(0, Math.min(100, (2 - vdiData) * 50));
      
      // LARS: positive = risk-on, negative = risk-off
      const larsNorm = Math.max(0, Math.min(100, 50 + larsData * 10));

      const overallScore = (ssiNorm + smfiNorm + vdiNorm + larsNorm) / 4;

      // Determine overall sentiment
      let overall: 'Risk-on' | 'Neutral' | 'Risk-off' = 'Neutral';
      if (overallScore > 60) overall = 'Risk-on';
      else if (overallScore < 40) overall = 'Risk-off';

      // Generate alerts based on real indicator thresholds
      const alerts: Array<{ type: 'positive' | 'negative' | 'neutral'; message: string; }> = [];
      
      if (Math.abs(smfiData) > 2) {
        alerts.push({
          type: smfiData > 1 ? 'negative' : 'positive',
          message: `Smart Money flyter ${smfiData > 1 ? 'defensivt' : 'offensivt'}`
        });
      }
      
      if (vdiData > 1.2) {
        alerts.push({ type: 'negative', message: 'Økt volatilitet i småbanker' });
      } else if (vdiData < 0.8) {
        alerts.push({ type: 'positive', message: 'Stabil volatilitet på tvers av segmenter' });
      }
      
      if (larsData > 0.5) {
        alerts.push({ type: 'positive', message: 'Positiv asymmetri under lav likviditet' });
      } else if (larsData < -0.5) {
        alerts.push({ type: 'negative', message: 'Negativ asymmetri indikerer de-risking' });
      }

      if (Math.abs(ssiData) > 1.5) {
        alerts.push({
          type: ssiData > 1.5 ? 'negative' : 'positive',
          message: `Sektorsentiment viser ${ssiData > 1.5 ? 'risk-off' : 'risk-on'} regime`
        });
      }

      setSentiment({
        overall,
        overallScore,
        indicators: {
          ssi: { value: ssiData, sentiment: ssiSentiment },
          smfi: { value: smfiData, sentiment: smfiSentiment },
          vdi: { value: vdiData },
          lars: { value: larsData },
        },
        alerts,
      });
    } catch (error) {
      console.error('❌ Error fetching market sentiment:', error);
      // Show error to user
      setSentiment(null);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'Risk-on') return 'hsl(var(--success))';
    if (sentiment === 'Risk-off') return 'hsl(var(--destructive))';
    return 'hsl(var(--warning))';
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'Risk-on') return <TrendingUp className="w-6 h-6" />;
    if (sentiment === 'Risk-off') return <TrendingDown className="w-6 h-6" />;
    return <Activity className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <Card className="shadow-lg border-2">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!sentiment) {
    return (
      <Card className="shadow-lg border-2 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Kunne ikke laste markedssentiment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Klarte ikke å hente data fra indikatorene. Sjekk konsollen for detaljer.
          </p>
          <Button onClick={fetchMarketSentiment} variant="outline">
            Prøv igjen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="shadow-lg border-2 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            Markedssentiment Oversikt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Sentiment Gauge */}
          <div className="flex items-center justify-between p-6 rounded-lg bg-card/50 border-2">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="p-4 rounded-full"
                style={{ backgroundColor: getSentimentColor(sentiment.overall) + '20' }}
              >
                <div style={{ color: getSentimentColor(sentiment.overall) }}>
                  {getSentimentIcon(sentiment.overall)}
                </div>
              </motion.div>
              <div>
                <div className="text-sm text-muted-foreground">Overordnet Sentiment</div>
                <div className="text-3xl font-bold" style={{ color: getSentimentColor(sentiment.overall) }}>
                  {sentiment.overall}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Score: {sentiment.overallScore.toFixed(0)}/100
                </div>
              </div>
            </div>
            
            {/* Mini Progress Bar */}
            <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${sentiment.overallScore}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full"
                style={{ backgroundColor: getSentimentColor(sentiment.overall) }}
              />
            </div>
          </div>

          {/* Indicator Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">SSI</div>
              <div className="text-2xl font-bold">{sentiment.indicators.ssi.value.toFixed(2)}</div>
              <Badge variant="outline" className="mt-2 text-xs">
                {sentiment.indicators.ssi.sentiment}
              </Badge>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">SMFI</div>
              <div className="text-2xl font-bold">{sentiment.indicators.smfi.value.toFixed(2)}</div>
              <Badge variant="outline" className="mt-2 text-xs">
                {sentiment.indicators.smfi.sentiment}
              </Badge>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">VDI</div>
              <div className="text-2xl font-bold">{sentiment.indicators.vdi.value.toFixed(2)}</div>
              <Badge 
                variant="outline" 
                className="mt-2 text-xs"
                style={{ 
                  borderColor: sentiment.indicators.vdi.value > 1.2 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'
                }}
              >
                {sentiment.indicators.vdi.value > 1.2 ? 'Stress' : 'Normal'}
              </Badge>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">LARS</div>
              <div className="text-2xl font-bold">{sentiment.indicators.lars.value.toFixed(2)}</div>
              <Badge 
                variant="outline" 
                className="mt-2 text-xs"
                style={{ 
                  borderColor: sentiment.indicators.lars.value > 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'
                }}
              >
                {sentiment.indicators.lars.value > 0 ? 'Risk-on' : 'Risk-off'}
              </Badge>
            </Card>
          </div>

          {/* Alerts Section */}
          {sentiment.alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                Viktige Signaler
              </div>
              <div className="space-y-2">
                {sentiment.alerts.map((alert, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-start gap-2 p-3 rounded-lg bg-card/50 border"
                    style={{
                      borderColor: alert.type === 'positive' 
                        ? 'hsl(var(--success))' 
                        : alert.type === 'negative' 
                        ? 'hsl(var(--destructive))' 
                        : 'hsl(var(--border))'
                    }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full mt-1.5"
                      style={{
                        backgroundColor: alert.type === 'positive' 
                          ? 'hsl(var(--success))' 
                          : alert.type === 'negative' 
                          ? 'hsl(var(--destructive))' 
                          : 'hsl(var(--warning))'
                      }}
                    />
                    <span className="text-sm">{alert.message}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
