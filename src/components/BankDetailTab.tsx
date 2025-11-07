import { useState, useEffect } from 'react';
import { BankData, Period } from '@/types/bank';
import { Card } from '@/components/ui/card';
import { PeriodSelector } from './PeriodSelector';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchWeeklyData } from '@/services/stockService';

interface BankDetailTabProps {
  bank: BankData;
}

export const BankDetailTab = ({ bank }: BankDetailTabProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    const loadChartData = async () => {
      if (selectedPeriod === 'today') {
        setChartData([]);
        return;
      }
      
      setLoadingChart(true);
      try {
        const data = await fetchWeeklyData(bank.ticker, selectedPeriod as 'month' | 'ytd' | 'year');
        const formattedData = data.map(d => ({
          date: d.date,
          price: d.price
        }));
        setChartData(formattedData);
      } catch (error) {
        console.error('Error loading chart data:', error);
        setChartData([]);
      } finally {
        setLoadingChart(false);
      }
    };

    loadChartData();
  }, [selectedPeriod, bank.ticker]);

  const getChangeForPeriod = (): number => {
    switch (selectedPeriod) {
      case 'today': return bank.todayChange;
      case 'month': return bank.monthChange;
      case 'ytd': return bank.ytdChange;
      case 'year': return bank.yearChange;
      default: return 0;
    }
  };

  const change = getChangeForPeriod();
  const isPositive = change >= 0;

  const periodLabels: Record<Period, string> = {
    today: 'I dag',
    month: 'Siste måned',
    ytd: 'Hittil i år',
    year: 'Siste år'
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg border-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold mb-1">{bank.name}</h2>
            <p className="text-muted-foreground">{bank.ticker}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{bank.currentPrice.toFixed(2)} NOK</div>
            <div className={`flex items-center gap-1 justify-end text-sm ${
              isPositive ? 'text-success' : 'text-destructive'
            }`}>
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </div>
          </div>
        </div>

        <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </Card>

      {/* Performance Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Clock size={16} />
            <span className="text-sm font-medium">I dag</span>
          </div>
          <div className={`text-2xl font-bold ${
            bank.todayChange >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {bank.todayChange >= 0 ? '+' : ''}{bank.todayChange.toFixed(2)}%
          </div>
        </Card>

        <Card className="p-4 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <DollarSign size={16} />
            <span className="text-sm font-medium">Siste måned</span>
          </div>
          <div className={`text-2xl font-bold ${
            bank.monthChange >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {bank.monthChange >= 0 ? '+' : ''}{bank.monthChange.toFixed(2)}%
          </div>
        </Card>

        <Card className="p-4 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Hittil i år</span>
          </div>
          <div className={`text-2xl font-bold ${
            bank.ytdChange >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {bank.ytdChange >= 0 ? '+' : ''}{bank.ytdChange.toFixed(2)}%
          </div>
        </Card>

        <Card className="p-4 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <TrendingDown size={16} />
            <span className="text-sm font-medium">Siste år</span>
          </div>
          <div className={`text-2xl font-bold ${
            bank.yearChange >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {bank.yearChange >= 0 ? '+' : ''}{bank.yearChange.toFixed(2)}%
          </div>
        </Card>
      </div>

      {/* Price Chart */}
      {selectedPeriod !== 'today' && (
        <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 border-2 shadow-lg">
          <h3 className="text-xl font-bold mb-4">
            Kursutvikling - {periodLabels[selectedPeriod]}
          </h3>
          {loadingChart ? (
            <div className="text-center py-8 text-muted-foreground">Laster data...</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  label={{ value: 'Kurs (NOK)', angle: -90, position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)} NOK`, 'Kurs']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  name={bank.name}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Ingen data tilgjengelig</div>
          )}
        </Card>
      )}

      {/* Current Period Details */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-2 shadow-lg">
        <h3 className="text-xl font-bold mb-4">
          Detaljert analyse - {periodLabels[selectedPeriod]}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Endring</div>
            <div className={`text-3xl font-bold flex items-center gap-2 ${
              isPositive ? 'text-success' : 'text-destructive'
            }`}>
              {isPositive ? <TrendingUp /> : <TrendingDown />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Nåværende kurs</div>
            <div className="text-3xl font-bold">{bank.currentPrice.toFixed(2)} NOK</div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Sist oppdatert: {bank.lastUpdated.toLocaleString('nb-NO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};
