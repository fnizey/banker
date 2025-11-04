import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SSBNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export const SSBNewsFeed = () => {
  const [news, setNews] = useState<SSBNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const RSS_URL = 'https://www.ssb.no/rss/';
        
        const response = await fetch(RSS_URL);
        const text = await response.text();
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        
        const items = Array.from(xml.querySelectorAll('item')).slice(0, 8);
        const newsItems: SSBNewsItem[] = items.map(item => ({
          title: item.querySelector('title')?.textContent || '',
          link: item.querySelector('link')?.textContent || '',
          description: item.querySelector('description')?.textContent?.replace(/<[^>]*>/g, '') || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
        }));
        
        setNews(newsItems);
      } catch (error) {
        console.error('Error fetching SSB news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
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

  return (
    <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Statistisk sentralbyrå</h2>
          <p className="text-sm text-muted-foreground">Siste publiseringer</p>
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
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {news.map((item, index) => (
              <a
                key={index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors flex-1">
                    {item.title}
                  </h3>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                </div>
                
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    SSB
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.pubDate)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
