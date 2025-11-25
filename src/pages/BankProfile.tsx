import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { BANKS } from '@/types/bank';

interface BankProfileData {
  ticker: string;
  category: string;
  momentum?: {
    macd: number;
    rsi: number;
    ma50: number;
    ma200: number;
    goldenCross: boolean;
  };
  alpha?: {
    bas: number;
    basEMA: number;
    rank: number;
  };
  outlier?: {
    sres: number;
    api: number;
    ats: number;
    isOutlier: boolean;
  };
  performance?: {
    today: number;
    month: number;
    ytd: number;
    year: number;
  };
}

const BANK_CATEGORIES: Record<string, string> = {
  'DNB.OL': 'Large', 'SB1NO.OL': 'Large', 'SBNOR.OL': 'Large', 'MING.OL': 'Large', 'SPOL.OL': 'Large', 'NONG.OL': 'Large', 'MORG.OL': 'Large',
  'SPOG.OL': 'Mid', 'HELG.OL': 'Mid', 'ROGS.OL': 'Mid', 'RING.OL': 'Mid', 'SOAG.OL': 'Mid', 'SNOR.OL': 'Mid',
  'HGSB.OL': 'Small', 'JAREN.OL': 'Small', 'AURG.OL': 'Small', 'SKUE.OL': 'Small', 'MELG.OL': 'Small', 'SOGN.OL': 'Small', 'HSPG.OL': 'Small', 'VVL.OL': 'Small', 'BIEN.OL': 'Small'
};

const BankProfile = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTicker = searchParams.get('ticker') || BANKS[0].ticker;
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<BankProfileData | null>(null);

  useEffect(() => {
    fetchBankProfile();
  }, [selectedTicker]);

  const fetchBankProfile = async () => {
    setLoading(true);
    try {
      const [momentumRes, alphaRes, outlierRes] = await Promise.all([
        supabase.functions.invoke('calculate-momentum', { body: { days: 365 } }),
        supabase.functions.invoke('calculate-alpha-engine', { body: { days: 365 } }),
        supabase.functions.invoke('calculate-outlier-radar', { body: { days: 90 } })
      ]);

      const momentumBank = momentumRes.data?.momentum?.find((b: any) => b.ticker === selectedTicker);
      const alphaBank = alphaRes.data?.leaderboard?.find((b: any) => b.ticker === selectedTicker);
      const outlierBank = outlierRes.data?.timeSeries?.[outlierRes.data.timeSeries.length - 1]?.banks?.find((b: any) => b.ticker === selectedTicker);

      setProfileData({
        ticker: selectedTicker,
        category: BANK_CATEGORIES[selectedTicker] || 'Unknown',
        momentum: momentumBank ? {
          macd: momentumBank.macd,
          rsi: momentumBank.rsi,
          ma50: momentumBank.ma50,
          ma200: momentumBank.ma200,
          goldenCross: momentumBank.goldenCross
        } : undefined,
        alpha: alphaBank ? {
          bas: alphaBank.bas,
          basEMA: alphaBank.basEMA,
          rank: alphaBank.rank
        } : undefined,
        outlier: outlierBank ? {
          sres: outlierBank.sres,
          api: outlierBank.api,
          ats: outlierBank.ats,
          isOutlier: Math.abs(outlierBank.sres) > 1.5
        } : undefined,
        performance: momentumBank ? {
          today: 0,
          month: 0,
          ytd: 0,
          year: 0
        } : undefined
      });
    } catch (error) {
      console.error('Error fetching bank profile:', error);
      toast.error('Kunne ikke hente bankprofil-data');
    } finally {
      setLoading(false);
    }
  };

  const handleBankChange = (ticker: string) => {
    setSearchParams({ ticker });
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Ingen data tilgjengelig for denne banken.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbake
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{profileData.ticker}</h1>
            <p className="text-muted-foreground">
              Kategori: {profileData.category} • Komplett bankprofil
            </p>
          </div>
        </div>
        <Select value={selectedTicker} onValueChange={handleBankChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANKS.map(bank => (
              <SelectItem key={bank.ticker} value={bank.ticker}>
                {bank.ticker}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alpha Score */}
      {profileData.alpha && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Alpha Score
              <Badge variant={profileData.alpha.rank <= 5 ? 'default' : 'secondary'}>
                #{profileData.alpha.rank}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">BAS (Bank Alpha Score)</div>
                <div className="text-2xl font-bold">{profileData.alpha.bas.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">BAS EMA (10-dag)</div>
                <div className="text-2xl font-bold">{profileData.alpha.basEMA.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Indicators */}
      {profileData.momentum && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MACD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{profileData.momentum.macd.toFixed(2)}</div>
                {profileData.momentum.macd > 0 ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">RSI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profileData.momentum.rsi.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {profileData.momentum.rsi > 70 ? 'Overkjøpt' : profileData.momentum.rsi < 30 ? 'Oversolgt' : 'Nøytral'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MA 50</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profileData.momentum.ma50.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MA 200</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profileData.momentum.ma200.toFixed(2)}</div>
              {profileData.momentum.goldenCross && (
                <Badge variant="default" className="mt-2">Golden Cross</Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Outlier Status */}
      {profileData.outlier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Outlier Status
              {profileData.outlier.isOutlier && (
                <Badge variant={profileData.outlier.sres > 0 ? 'default' : 'destructive'}>
                  {profileData.outlier.sres > 0 ? 'Positiv Outlier' : 'Negativ Outlier'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">SRES (Smoothed Residual)</div>
                <div className="text-xl font-bold">{profileData.outlier.sres.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">API (Persistence)</div>
                <div className="text-xl font-bold">{profileData.outlier.api.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ATS (Turnover Score)</div>
                <div className="text-xl font-bold">{profileData.outlier.ats.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Oppsummering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profileData.alpha && (
            <p>
              <strong>Alpha:</strong> {profileData.ticker} rangerer som #{profileData.alpha.rank} med en BAS på {profileData.alpha.bas.toFixed(2)}.
            </p>
          )}
          {profileData.momentum && (
            <p>
              <strong>Momentum:</strong> MACD er {profileData.momentum.macd > 0 ? 'positiv' : 'negativ'} ({profileData.momentum.macd.toFixed(2)}), 
              RSI på {profileData.momentum.rsi.toFixed(1)} indikerer {profileData.momentum.rsi > 70 ? 'overkjøpt' : profileData.momentum.rsi < 30 ? 'oversolgt' : 'nøytral'} status.
              {profileData.momentum.goldenCross && ' Golden Cross detektert.'}
            </p>
          )}
          {profileData.outlier && profileData.outlier.isOutlier && (
            <p>
              <strong>Outlier:</strong> Banken er en {profileData.outlier.sres > 0 ? 'positiv' : 'negativ'} outlier 
              med SRES på {profileData.outlier.sres.toFixed(2)}.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BankProfile;
