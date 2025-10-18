import { BankData, Period } from '@/types/bank';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BankCardProps {
  bank: BankData;
  period: Period;
  rank: number;
}

const getChangeForPeriod = (bank: BankData, period: Period): number => {
  switch (period) {
    case 'today':
      return bank.todayChange;
    case 'month':
      return bank.monthChange;
    case 'ytd':
      return bank.ytdChange;
    case 'year':
      return bank.yearChange;
    default:
      return 0;
  }
};

export const BankCard = ({ bank, period, rank }: BankCardProps) => {
  const change = getChangeForPeriod(bank, period);
  const isPositive = change >= 0;

  return (
    <Card className="p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>
            <h3 className="font-semibold text-sm truncate">{bank.name}</h3>
          </div>
          <a
            href={`https://finance.yahoo.com/quote/${bank.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
            title="Se på Yahoo Finance"
          >
            {bank.ticker}
          </a>
        </div>
        
        <div className="text-right">
          <div className={cn(
            "flex items-center gap-1 text-2xl font-bold tabular-nums",
            isPositive ? "text-success" : "text-destructive"
          )}>
            {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            {bank.currentPrice.toFixed(2)} NOK
          </div>
        </div>
      </div>
    </Card>
  );
};
