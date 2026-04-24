import { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: 'cyan' | 'orange' | 'green' | 'yellow';
};

const accentStyles: Record<NonNullable<Props['accent']>, string> = {
  cyan: 'bg-brand-cyan/10 text-brand-cyan',
  orange: 'bg-brand-orange/10 text-brand-orange',
  green: 'bg-brand-green/15 text-green-700',
  yellow: 'bg-brand-yellow/15 text-amber-700',
};

export function Stat({ label, value, icon: Icon, accent = 'cyan' }: Props) {
  return (
    <div className="card flex items-center gap-4">
      {Icon && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentStyles[accent]}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
