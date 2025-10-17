import { Period } from '@/types/bank';
import { Button } from '@/components/ui/button';

interface PeriodSelectorProps {
  selected: Period;
  onChange: (period: Period) => void;
}

const periods: { value: Period; label: string }[] = [
  { value: 'today', label: 'I dag' },
  { value: 'month', label: 'Siste måned' },
  { value: 'ytd', label: 'Hittil i år' },
  { value: 'year', label: 'Siste år' },
];

export const PeriodSelector = ({ selected, onChange }: PeriodSelectorProps) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={selected === period.value ? 'default' : 'outline'}
          onClick={() => onChange(period.value)}
          className="font-medium"
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
};
