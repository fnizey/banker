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
    <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Valutakurser</h2>
          <p className="text-sm text-muted-foreground">Fra Norges Bank</p>
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
        <div className="space-y-3">
          {rates.map((rate, index) => {
            const Icon = getCurrencyIcon(rate.currency);
            return (
              <div
                key={index}
                className="p-4 rounded-lg border border-border/50 bg-accent/5 hover:bg-accent/10 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="text-xs font-bold">
                        {rate.currency}/NOK
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {rate.rate}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
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
