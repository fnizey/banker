import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink } from 'lucide-react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export const NewsFeed = () => {
  // Placeholder news items - in production this would fetch from Yahoo Finance RSS
  const newsItems: NewsItem[] = [
    {
      title: "Sparebank 1 SMN med solid resultat",
      link: "https://live.euronext.com/",
      pubDate: new Date().toLocaleDateString('nb-NO'),
      source: "Euronext"
    },
    {
      title: "Norske sparebanker fortsetter veksten",
      link: "https://live.euronext.com/",
      pubDate: new Date().toLocaleDateString('nb-NO'),
      source: "Oslo Børs"
    }
  ];

  return (
    <Card className="p-4 h-full">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        📰 Siste nyheter
      </h3>
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {newsItems.map((item, index) => (
            <a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-border hover:bg-accent transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium group-hover:text-primary transition-colors mb-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.pubDate}</span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
