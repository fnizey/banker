import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Euro, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CurrencyRate {
  currency: string;
  rate: string;
  date: string;
  title: string;
}

export const CurrencyRates = () => {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const feeds = [
          { 
            url: 'https://www.norges-bank.no/RSS/Amerikanske-dollar-USD---dagens-valutakurs-fra-Norges-Bank/',
            currency: 'USD',
            icon: DollarSign
          },
          { 
            url: 'https://www.norges-bank.no/RSS/euro-eur---dagens-valutakurs-fra-norges-bank/',
            currency: 'EUR',
            icon: Euro
          }
        ];

        const ratesData: CurrencyRate[] = [];

        for (const feed of feeds) {
          const response = await fetch(feed.url);
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'text/xml');
          
          const item = xml.querySelector('item');
          if (item) {
            const title = item.querySelector('title')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            
            // Extract rate from description
            const rateMatch = description.match(/(\d+[.,]\d+)/);
            const rate = rateMatch ? rateMatch[1].replace(',', '.') : '';

            ratesData.push({
              currency: feed.currency,
              rate,
              date: pubDate,
              title
            });
          }
        }

        setRates(ratesData);
      } catch (error) {
        console.error('Error fetching currency rates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const getCurrencyIcon = (currency: string) => {
    return currency === 'USD' ? DollarSign : Euro;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card via-card/50 to-chart-1/10 shadow-lg border-border/50 hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-chart-1/20 rounded-xl shadow-sm">
          <TrendingUp className="h-6 w-6 text-chart-1" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">Valutakurser</h2>
          <p className="text-sm text-muted-foreground">Norges Bank</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rates.map((rate, index) => {
            const Icon = getCurrencyIcon(rate.currency);
            const isUSD = rate.currency === 'USD';
            return (
              <div
                key={index}
                className="p-5 rounded-xl border border-border/40 bg-gradient-to-br from-card/50 to-accent/5 hover:shadow-lg hover:border-chart-1/40 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 ${isUSD ? 'bg-chart-1/20' : 'bg-chart-3/20'} rounded-xl shadow-sm group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-6 w-6 ${isUSD ? 'text-chart-1' : 'text-chart-3'}`} />
                    </div>
                    <div>
                      <Badge variant="secondary" className={`text-sm font-bold ${isUSD ? 'bg-chart-1/10 text-chart-1 border-chart-1/20' : 'bg-chart-3/10 text-chart-3 border-chart-3/20'}`}>
                        {rate.currency}/NOK
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${isUSD ? 'text-chart-1' : 'text-chart-3'} tracking-tight`}>
                      {rate.rate}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${isUSD ? 'bg-chart-1' : 'bg-chart-3'} animate-pulse`}></span>
                  Oppdatert: {formatDate(rate.date)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
