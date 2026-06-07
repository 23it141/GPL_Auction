import React from 'react';
import { BidFeedItem } from '../types';
import { Gavel } from 'lucide-react';

interface LiveBidFeedProps {
  bids: BidFeedItem[];
}

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const LiveBidFeed: React.FC<LiveBidFeedProps> = ({ bids }) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-premium overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="w-4 h-4 text-brand-blue" />
          <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Live Bid Log</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue/10 text-brand-blue">
          REAL-TIME
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[300px]">
        {bids.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Gavel className="w-8 h-8 text-slate-200 mb-2 animate-bounce" />
            <p className="text-xs font-semibold">Waiting for opening bid...</p>
          </div>
        ) : (
          bids.map((bid, index) => {
            const isHighest = index === 0;
            return (
              <div
                key={`${bid.timestamp}-${index}`}
                className={`p-3.5 rounded-xl border transition-all duration-300 ${
                  isHighest
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50/30 border-amber-200 shadow-md ring-2 ring-amber-400/20 translate-x-1'
                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isHighest && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 live-pulse shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-800">{bid.teamName}</p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                        {bid.teamCode} &bull; {new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold ${
                        isHighest ? 'text-amber-700 text-base' : 'text-slate-600'
                      }`}
                    >
                      {formatPrice(bid.bidAmount)}
                    </span>
                    {isHighest && (
                      <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-widest mt-0.5">
                        Current Leader
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LiveBidFeed;
