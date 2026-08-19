import React from 'react';
import { Greeks } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface GreeksCardProps {
  greeks: Greeks;
}

export const GreeksCard: React.FC<GreeksCardProps> = ({ greeks }) => {
  const data = [
    { name: 'Δ Delta', value: greeks.delta, info: 'Price sensitivity. Roughly probability of ITM.' },
    { name: 'Γ Gamma', value: greeks.gamma, info: 'Rate of Delta change. Acceleration.' },
    { name: 'Θ Theta', value: greeks.theta, info: 'Time decay. Daily loss in value.' },
    { name: 'ν Vega', value: greeks.vega, info: 'Volatility sensitivity.' },
  ];

  const formatValue = (val: number) => val.toFixed(3);

  return (
    <div className="bg-terminal-gray border border-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-mono font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">
        The Greeks
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase">Delta (Δ)</div>
          <div className="text-terminal-accent text-2xl font-mono">{greeks.delta}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase">Gamma (Γ)</div>
          <div className="text-purple-400 text-2xl font-mono">{greeks.gamma}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase">Theta (Θ)</div>
          <div className="text-terminal-red text-2xl font-mono">{greeks.theta}</div>
        </div>
        <div className="p-3 bg-black/40 rounded border border-gray-800">
          <div className="text-gray-400 text-xs font-mono uppercase">Vega (ν)</div>
          <div className="text-yellow-400 text-2xl font-mono">{greeks.vega}</div>
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
        <p>Values are theoretical estimates based on current market data.</p>
      </div>
    </div>
  );
};