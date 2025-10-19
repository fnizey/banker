import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, TrendingUp } from 'lucide-react';
import { fetchBankCalendarEvents } from '@/services/stockService';

interface CalendarEvent {
  ticker: string;
  bankName: string;
  earningsDate?: Date;
  dividendDate?: Date;
  exDividendDate?: Date;
}

interface BankCalendarProps {
  tickers: string[];
}

export const BankCalendar = ({ tickers }: BankCalendarProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCalendarData = async () => {
      if (tickers.length === 0) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      console.log('Loading calendar for tickers:', tickers);
      try {
        const calendarData = await fetchBankCalendarEvents(tickers);
        console.log('Received calendar events:', calendarData);
        setEvents(calendarData);
      } catch (error) {
        console.error('Error loading calendar events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarData();
  }, [tickers]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5" />
        <h3 className="text-xl font-semibold">Viktige Datoer</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="border-l-2 border-primary pl-4 py-2">
                <h4 className="font-semibold text-sm">{event.bankName}</h4>
                <div className="text-xs text-muted-foreground space-y-1 mt-1">
                  {event.earningsDate && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" />
                      <span>Kvartalsrapport: {formatDate(event.earningsDate)}</span>
                    </div>
                  )}
                  {event.dividendDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-success">💰</span>
                      <span>Utbytte: {formatDate(event.dividendDate)}</span>
                    </div>
                  )}
                  {event.exDividendDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">📅</span>
                      <span>Ex-dividend: {formatDate(event.exDividendDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingen kommende hendelser tilgjengelig
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};