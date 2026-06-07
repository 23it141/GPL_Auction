import React, { ElementType } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ElementType;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'cyan';
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtitle }) => {
  const colorMaps = {
    blue: {
      bg: 'bg-brand-blue-light border-brand-blue/20',
      icon: 'text-brand-blue bg-brand-blue/10',
    },
    green: {
      bg: 'bg-brand-green-light border-brand-green/20',
      icon: 'text-brand-green bg-brand-green/10',
    },
    orange: {
      bg: 'bg-brand-orange-light border-brand-orange/20',
      icon: 'text-brand-orange bg-brand-orange/10',
    },
    purple: {
      bg: 'bg-brand-purple-light border-brand-purple/20',
      icon: 'text-brand-purple bg-brand-purple/10',
    },
    cyan: {
      bg: 'bg-brand-cyan-light border-brand-cyan/20',
      icon: 'text-brand-cyan bg-brand-cyan/10',
    },
  };

  const selectedColor = colorMaps[color] || colorMaps.blue;

  return (
    <div className={`p-6 rounded-2xl border glass-panel transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 flex items-start justify-between ${selectedColor.bg}`}>
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${selectedColor.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

export default StatCard;
