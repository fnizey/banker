import { BankData, Period } from '@/types/bank';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BankHeatmapProps {
  banksData: BankData[];
  selectedPeriod: Period;
}

export const BankHeatmap = ({ banksData, selectedPeriod }: BankHeatmapProps) => {
  const getChangeForPeriod = (bank: BankData): number => {
    switch (selectedPeriod) {
      case 'today': return bank.todayChange;
      case 'month': return bank.monthChange;
      case 'ytd': return bank.ytdChange;
      case 'year': return bank.yearChange;
      default: return 0;
    }
  };

  const getIntensityColor = (change: number) => {
    const absChange = Math.abs(change);
    const intensity = Math.min(absChange / 10, 1); // Max intensity at 10% change
    
    if (change > 0) {
      return `hsl(var(--success) / ${0.1 + intensity * 0.9})`;
    } else if (change < 0) {
      return `hsl(var(--destructive) / ${0.1 + intensity * 0.9})`;
    }
    return 'hsl(var(--muted))';
  };

  // Sort banks by change (highest positive to most negative)
  const sortedBanks = [...banksData].sort((a, b) => {
    const changeA = getChangeForPeriod(a);
    const changeB = getChangeForPeriod(b);
    return changeB - changeA; // Descending order
  });

  return (
    <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 shadow-lg border-2">
      <h3 className="text-xl font-bold mb-4">Bank Heatmap</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {sortedBanks.map((bank) => {
          const change = getChangeForPeriod(bank);
          return (
            <div
              key={bank.ticker}
              className={cn(
                "relative group cursor-pointer rounded-lg p-3 transition-all duration-200 hover:scale-105 hover:shadow-lg",
                "flex flex-col items-center justify-center text-center min-h-[80px]"
              )}
              style={{ backgroundColor: getIntensityColor(change) }}
            >
              <div className="text-xs font-semibold text-foreground mb-1 line-clamp-2">
                {bank.name}
              </div>
              <div className={cn(
                "text-sm font-bold",
                change > 0 ? "text-success-foreground" : change < 0 ? "text-destructive-foreground" : "text-muted-foreground"
              )}>
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-xl text-xs whitespace-nowrap border">
                  <div className="font-semibold">{bank.name}</div>
                  <div>Ticker: {bank.ticker}</div>
                  <div className={change > 0 ? "text-success" : change < 0 ? "text-destructive" : ""}>
                    Endring: {change > 0 ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
