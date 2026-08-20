import React from 'react';
import { Greeks } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface GreeksCardProps {
  greeks: Greeks;
}

export const GreeksCard: React.FC<GreeksCardProps> = ({ greeks }) => {
  // Market-convention display precision — short enough to fit in the grid card
  const fmtDelta = (v: number) => v.toFixed(3);
  const fmtGamma = (v: number) => {
    if (Math.abs(v) < 0.001) return v.toExponential(2);  // e.g. 6.38e-3
    return v.toFixed(4);
  };
  const fmtTheta = (v: number) => v.toFixed(3);
  const fmtVega  = (v: number) => v.toFixed(3);

  const data = [
    { name: 'Δ Delta', value: greeks.delta, info: 'Price sensitivity. Roughly probability of ITM.' },
    { name: 'Γ Gamma', value: greeks.gamma, info: 'Rate of Delta change. Acceleration.' },
    { name: 'Θ Theta', value: greeks.theta, info: 'Time decay. Daily loss in value.' },
    { name: 'ν Vega', value: greeks.vega, info: 'Volatility sensitivity.' },
  ];

  const formatValue = (val: number) => val.toFixed(4);

  return (
    <div className="bg-terminal-gray border border-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-mono font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">
        The Greeks
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase mb-1">Delta (Δ)</div>
          <div className="text-terminal-accent text-lg font-mono font-bold">{fmtDelta(greeks.delta)}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase mb-1">Gamma (Γ)</div>
          <div className="text-purple-400 text-lg font-mono font-bold">{fmtGamma(greeks.gamma)}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase mb-1">Theta (Θ)</div>
          <div className="text-terminal-red text-lg font-mono font-bold">{fmtTheta(greeks.theta)}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase mb-1">Vega (ν)</div>
          <div className="text-yellow-400 text-lg font-mono font-bold">{fmtVega(greeks.vega)}</div>
        </div>
      </div>

      <div className="h-48 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }} 
              width={80}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
              itemStyle={{ fontFamily: 'monospace' }}
              cursor={{fill: 'transparent'}}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value < 0 ? '#ff0033' : '#00b8ff'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-500 font-mono">
        <p><span className="text-terminal-accent">IV (Implied Volatility):</span> {(greeks.iv * 100).toFixed(1)}%</p>
        {(greeks.charm !== undefined || greeks.vanna !== undefined || greeks.volga !== undefined) && (
          <div className="mt-3 border-t border-gray-800 pt-3">
            <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">2nd-Order Cross-Greeks</p>
            <div className="grid grid-cols-3 gap-2">
              {greeks.charm !== undefined && (
                <div className="p-2 bg-black/30 rounded border border-gray-800">
                  <div className="text-gray-500 text-[10px] uppercase">Charm (dΔ/dt)</div>
                  <div className="text-blue-300 text-sm font-mono">{greeks.charm.toFixed(5)}</div>
                  <div className="text-gray-600 text-[9px]">Delta decay/day</div>
                </div>
              )}
              {greeks.vanna !== undefined && (
                <div className="p-2 bg-black/30 rounded border border-gray-800">
                  <div className="text-gray-500 text-[10px] uppercase">Vanna (dΔ/dσ)</div>
                  <div className="text-emerald-300 text-sm font-mono">{greeks.vanna.toFixed(5)}</div>
                  <div className="text-gray-600 text-[9px]">Vol/spot cross</div>
                </div>
              )}
              {greeks.volga !== undefined && (
                <div className="p-2 bg-black/30 rounded border border-gray-800">
                  <div className="text-gray-500 text-[10px] uppercase">Volga (dν/dσ)</div>
                  <div className="text-amber-300 text-sm font-mono">{greeks.volga.toFixed(5)}</div>
                  <div className="text-gray-600 text-[9px]">Vol convexity</div>
                </div>
              )}
            </div>
          </div>
        )}
        <p>Values are theoretical estimates based on current market data.</p>
      </div>
    </div>
  );
};