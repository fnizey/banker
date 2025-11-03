import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AlertsBell } from './AlertsBell';
import { SearchBar } from './SearchBar';

export const Navigation = () => {
  const location = useLocation();
  
  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/tabell', label: 'Tabell' },
    { path: '/grafer', label: 'Grafer' },
    { path: '/rapporter', label: 'Rapporter' },
  ];
  
  return (
    <div className="space-y-4 mb-6">
      <nav className="border border-border bg-gradient-to-r from-card via-card to-accent/5 rounded-xl shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "py-4 px-4 border-b-2 transition-all text-sm font-semibold relative",
                    location.pathname === link.path
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <AlertsBell />
          </div>
        </div>
      </nav>
      <SearchBar />
    </div>
  );
};
