import React from 'react';
import { Player } from '../types';
import { User, Activity, AlertCircle } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
}

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  const roleColors = {
    'Batsman': 'bg-brand-blue-light text-brand-blue-dark border-brand-blue/20',
    'Bowler': 'bg-brand-green-light text-brand-green-dark border-brand-green/20',
    'All-Rounder': 'bg-brand-purple-light text-brand-purple-dark border-brand-purple/20',
    'Wicket-Keeper': 'bg-brand-cyan-light text-brand-cyan-dark border-brand-cyan/20',
  };

  const roleColor = roleColors[player.role] || roleColors['Batsman'];

  const getCategoryDisplay = (category?: string) => {
    if (!category) return { label: 'No Category', classes: 'bg-slate-100 text-slate-600 border-slate-200' };
    const cat = category.toUpperCase();
    if (cat === 'A' || cat === 'MARQUEE') {
      return { label: 'Category A', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (cat === 'B' || cat === 'CAPPED') {
      return { label: 'Category B', classes: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    if (cat === 'C' || cat === 'UNCAPPED') {
      return { label: 'Category C', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (cat === 'D') {
      return { label: 'Category D', classes: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    return { label: category, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const catDisplay = getCategoryDisplay(player.category);
  const isMarquee = player.category && (player.category.toUpperCase() === 'MARQUEE' || player.category.toUpperCase() === 'A');

  return (
    <div className={`glass-card rounded-2xl border p-6 relative overflow-hidden transition-all duration-300 hover:shadow-premium border-slate-200`}>
      {/* Visual Accent for Marquee Players */}
      {isMarquee && (
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
      )}

      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        {/* Photo Container */}
        <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl border border-slate-100 bg-gradient-to-tr from-slate-100 to-slate-50 flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden group">
          {player.photo ? (
            <img
              src={player.photo}
              alt={player.playerName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center text-slate-300">
              <User className="w-12 h-12" />
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">GPL Player</span>
            </div>
          )}
          {isMarquee && (
            <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white shadow-sm">
              {player.category.toUpperCase() === 'MARQUEE' ? 'MARQUEE' : 'CAT A'}
            </span>
          )}
        </div>

        {/* Player Details */}
        <div className="flex-1 w-full space-y-4">
          <div className="text-center md:text-left space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight font-sans">
              {player.playerName}
            </h2>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${roleColor}`}>
                {player.role}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Age: {player.age}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${catDisplay.classes}`}>
                {catDisplay.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batting Style</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {player.battingStyle || 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bowling Style</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {player.bowlingStyle || 'N/A'}
              </p>
            </div>
          </div>

          {player.description && (
            <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
              {player.description}
            </p>
          )}

          {/* Pricing Info */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Price</p>
              <p className="text-lg font-bold text-slate-600">{formatPrice(player.basePrice)}</p>
            </div>

            {player.soldStatus === 'sold' && player.soldTo && player.soldPrice && (
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-green-light text-brand-green-dark border border-brand-green/20">
                  <Activity className="w-3.5 h-3.5" /> SOLD
                </span>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  to <span className="font-bold text-slate-700">{player.soldTo.teamName}</span> for{' '}
                  <span className="font-bold text-brand-green">{formatPrice(player.soldPrice)}</span>
                </p>
              </div>
            )}

            {player.soldStatus === 'unsold' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                <AlertCircle className="w-3.5 h-3.5" /> UNSOLD
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
