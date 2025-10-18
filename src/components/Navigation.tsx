import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const Navigation = () => {
  const location = useLocation();
  
  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/tabell', label: 'Tabell' },
    { path: '/grafer', label: 'Grafer' },
  ];
  
  return (
    <nav className="border-b border-border bg-card mb-6">
      <div className="container mx-auto px-4">
        <div className="flex space-x-8">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "py-4 px-2 border-b-2 transition-colors text-sm font-medium",
                location.pathname === link.path
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};
