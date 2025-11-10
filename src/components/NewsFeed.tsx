import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  category: string;
  pubDate: string;
  creator: string;
}

export const NewsFeed = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // Using the correct FinansWatch RSS feed
        const RSS_URL = 'https://rss-feed-api.aws.jyllands-posten.dk/finanswatch.no/latest';
        
        const response = await fetch(RSS_URL);
        const text = await response.text();
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        
        const items = Array.from(xml.querySelectorAll('item')).slice(0, 50);
        const newsItems: NewsItem[] = items.map(item => ({
          title: item.querySelector('title')?.textContent || '',
          link: item.querySelector('link')?.textContent || '',
          description: item.querySelector('description')?.textContent?.replace(/<[^>]*>/g, '') || '',
          category: item.querySelector('category')?.textContent || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
          creator: item.querySelector('dc\\:creator, creator')?.textContent || '',
        }));
        
        setNews(newsItems);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    
    // Oppdater automatisk hvert minutt
    const interval = setInterval(() => {
      fetchNews();
    }, 60000); // 1 minutt = 60000 ms

    // Cleanup når komponenten unmountes
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 24) {
      return `${diffHours}t siden`;
    } else if (diffDays === 1) {
      return 'I går';
    } else if (diffDays < 7) {
      return `${diffDays}d siden`;
    } else {
      return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
    }
  };

  const getSectorCounts = () => {
    const now = new Date();
    const last24Hours = news.filter(item => {
      const itemDate = new Date(item.pubDate);
      const diffMs = now.getTime() - itemDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours <= 24;
    });

    const categoryCounts: Record<string, number> = {};
    last24Hours.forEach(item => {
      if (item.category) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }
    });

    return {
      counts: categoryCounts,
      total: last24Hours.length
    };
  };

  // const sectorData = getSectorCounts(); // Midlertidig deaktivert

  return (
    <Card className="p-6 bg-gradient-to-br from-card via-card/50 to-primary/10 shadow-lg border-border/50 hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/20 rounded-xl shadow-sm">
          <Newspaper className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">FinansWatch</h2>
          <p className="text-sm text-muted-foreground">Siste finansnyheter</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Seksjonsoversikt midlertidig deaktivert */}
          
          <ScrollArea className="h-[420px] pr-4">
            <div className="space-y-3">
              {news.map((item, index) => (
                <a
                  key={index}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-xl border border-border/40 bg-card/50 hover:border-primary/40 hover:bg-accent/10 hover:shadow-md transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors flex-1">
                      {item.title}
                    </h3>
                    <ExternalLink className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                  
                  <p className="text-xs text-muted-foreground/90 line-clamp-2 mb-3 leading-relaxed">
                    {item.description}
                  </p>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.category && (
                      <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                        {item.category}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground/70">
                      {formatDate(item.pubDate)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
};
