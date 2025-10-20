import { useBankData } from '@/contexts/BankDataContext';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, ExternalLink, Coins } from 'lucide-react';

interface BankCalendarProps {
  tickers: string[];
}

export const BankCalendar = ({ tickers }: BankCalendarProps) => {
  const { banksData } = useBankData();
  const selectedBanks = banksData.filter(bank => tickers.includes(bank.ticker));

  const getCurrentQuarter = () => {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
  };

  const getNextReportingPeriod = () => {
    const month = new Date().getMonth() + 1;
    if (month <= 1) return 'slutten av januar/starten av februar';
    if (month <= 4) return 'slutten av april/starten av mai';
    if (month <= 7) return 'slutten av juli/starten av august';
    if (month <= 10) return 'slutten av oktober/starten av november';
    return 'slutten av januar/starten av februar (neste år)';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5" />
        <h3 className="text-xl font-semibold">Finanskalender</h3>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-6">
          <div className="p-4 bg-accent/30 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <TrendingUp className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                <h4 className="font-semibold text-sm">Kvartalsrapporter</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Norske sparebanker rapporterer vanligvis i {getNextReportingPeriod()}.
                  Nåværende kvartal: {getCurrentQuarter()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-accent/30 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Coins className="w-4 h-4 mt-0.5 text-success" />
              <div>
                <h4 className="font-semibold text-sm">Utbytte</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  De fleste banker betaler utbytte én gang årlig, vanligvis i april/mai etter årsmøtet.
                </p>
              </div>
            </div>
          </div>

          {selectedBanks.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">Valgte banker:</h4>
              <div className="space-y-2">
                {selectedBanks.map((bank) => (
                  <div key={bank.ticker} className="border-l-2 border-primary pl-4 py-2">
                    <h5 className="font-medium text-sm">{bank.name}</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bank.ticker}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => window.open('https://live.euronext.com/nb/markets/oslo/financial-calendars', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              Se fullstendig kalender på Euronext
            </Button>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
            <p className="font-medium mb-1">ℹ️ Om finanskalenderen</p>
            <p>
              For nøyaktige datoer for kvartalsrapporter og utbytte, se den offisielle 
              finanskalenderen på Euronext Oslo eller besøk bankenes egne nettsider.
            </p>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
};