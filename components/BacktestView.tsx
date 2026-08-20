import React, { useState } from 'react';
import { BacktestResponse } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../FirebaseProvider';
import { saveRunToDatabase } from '../services/historyService';
import { exportAsPDF, exportAsJSON, exportAsTextReport, exportAsCSV, printDocument } from '../services/exportUtils';
import { Calendar, Activity, Save, BookmarkCheck, FileText, FileSpreadsheet, FileCode, Printer, Loader2, Download } from 'lucide-react';

interface BacktestViewProps {
  data: BacktestResponse;
  reset: () => void;
}

export const BacktestView: React.FC<BacktestViewProps> = ({ data, reset }) => {
  const { user } = useAuth();
  const { result, groundingChunks } = data;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Calculate cumulative P/L for the chart
  let runningPnl = 0;
  const chartData = result.trades.map((trade, index) => {
    runningPnl += trade.pnlAmount;
    return {
      name: `Trade ${index + 1}`,
      date: trade.exitDate,
      pnl: runningPnl,
      tradePnl: trade.pnlAmount
    };
  });

  // Add initial point
  const fullChartData = [{ name: 'Start', date: result.trades[0]?.entryDate, pnl: 0, tradePnl: 0 }, ...chartData];

  const handleSaveToDb = async () => {
    if (!user) {
      alert("Please sign in to save backtests to your database.");
      return;
    }
    setSaving(true);
    try {
      await saveRunToDatabase(user.uid, {
        ticker: result.ticker,
        mode: 'BACKTEST',
        title: `${result.ticker} ${result.period} Backtest Simulation`,
        result: data
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save backtest to database.");
    } finally {
      setSaving(false);
    }
  };

  const exportPayload = {
    ticker: result.ticker,
    mode: 'BACKTEST',
    title: `${result.ticker} Backtest Simulation Report`,
    result: data
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            {result.ticker}
            <span className="text-sm font-mono font-normal text-gray-400 px-3 py-1 bg-gray-800 rounded-full uppercase">
              {result.period} Backtest
            </span>
          </h2>
        </div>
        <button 
          onClick={reset}
          className="px-4 py-2 text-sm font-mono text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
        >
          New Simulation
        </button>
      </div>

      {/* Save & Export Toolbar */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-white font-bold">
          <span className="w-2 h-2 rounded-full bg-terminal-accent animate-ping" />
          <span>Backtest Simulation Complete</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveToDb}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
              saved 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-terminal-accent text-black hover:bg-white'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <BookmarkCheck size={14} /> : <Save size={14} />}
            {saved ? "Saved to History" : "Save to Database"}
          </button>

          <span className="text-gray-700">|</span>

          <button 
            onClick={() => exportAsPDF(exportPayload)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-500/40 text-xs text-sky-300 font-bold rounded-lg transition-all shadow-sm group"
            title="Export Formatted PDF Backtest Audit Report for External Review"
          >
            <Download size={14} className="text-sky-400 group-hover:translate-y-0.5 transition-transform" />
            <span>PDF Report</span>
            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded font-mono hidden sm:inline">Audit-Ready</span>
          </button>

          <button 
            onClick={() => exportAsTextReport(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export Text Report"
          >
            <FileText size={14} className="text-blue-400" /> .TXT
          </button>

          <button 
            onClick={() => exportAsCSV(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export CSV Table"
          >
            <FileSpreadsheet size={14} className="text-green-400" /> CSV
          </button>

          <button 
            onClick={() => exportAsJSON(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export JSON"
          >
            <FileCode size={14} className="text-yellow-400" /> JSON
          </button>

          <button 
            onClick={() => printDocument(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Print / Save PDF"
          >
            <Printer size={14} className="text-purple-400" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Strategy Overview */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 mb-8">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity size={16} /> Strategy Overview
        </h3>
        <div className="mb-4">
          <span className="text-terminal-accent font-mono text-lg font-bold">
            {result.strategy?.name || 'Trend Following Options'}
          </span>
        </div>
        
        {result.strategy?.parameters && result.strategy.parameters.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {result.strategy.parameters.map((param, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-800 text-gray-300 text-xs font-mono rounded">
                {param}
              </span>
            ))}
          </div>
        )}
        
        <p className="text-gray-300 leading-relaxed text-sm">
          {result.summary}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`p-6 rounded-xl border ${result.totalPnl >= 0 ? 'bg-terminal-green/10 border-terminal-green/30' : 'bg-terminal-red/10 border-terminal-red/30'}`}>
          <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-mono uppercase">Total Net P/L</div>
          <div className={`text-3xl font-bold font-mono ${result.totalPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {result.totalPnl >= 0 ? '+' : ''}${result.totalPnl.toLocaleString()}
          </div>
        </div>
        <div className="p-6 rounded-xl border bg-terminal-gray border-gray-800">
          <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-mono uppercase">Win Rate</div>
          <div className="text-3xl font-bold font-mono text-terminal-accent">
            {result.winRate}%
          </div>
        </div>
        <div className="p-6 rounded-xl border bg-terminal-gray border-gray-800">
          <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-mono uppercase">Total Trades</div>
          <div className="text-3xl font-bold font-mono text-white">
            {result.trades.length}
          </div>
        </div>
      </div>

      {/* P/L Chart */}
      <div className="bg-terminal-gray border border-gray-800 rounded-lg p-6 shadow-lg mb-8">
        <h3 className="text-lg font-mono font-bold text-gray-200 mb-6 flex items-center gap-2">
          <Activity size={18} className="text-terminal-accent" />
          Cumulative Performance
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fullChartData}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={result.totalPnl >= 0 ? '#00ff41' : '#ff0033'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={result.totalPnl >= 0 ? '#00ff41' : '#ff0033'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="name" hide />
              <YAxis 
                tick={{ fill: '#666', fontSize: 12, fontFamily: 'monospace' }} 
                tickFormatter={(value) => `$${value}`}
                width={60}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff', fontFamily: 'monospace' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke={result.totalPnl >= 0 ? '#00ff41' : '#ff0033'} 
                fillOpacity={1} 
                fill="url(#colorPnl)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade Log */}
      <div className="space-y-4">
        <h3 className="text-lg font-mono font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-terminal-accent" />
          Trade Log
        </h3>
        {result.trades.map((trade, idx) => (
          <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${trade.type === 'Call' ? 'bg-terminal-green/20 text-terminal-green' : 'bg-terminal-red/20 text-terminal-red'}`}>
                  {trade.type}
                </span>
                <span className="text-white font-mono font-bold">${trade.strike} Strike</span>
                <span className="text-gray-500 text-sm">
                  {trade.entryDate} <span className="mx-1">→</span> {trade.exitDate}
                </span>
              </div>
              <div className={`font-mono font-bold ${trade.pnlAmount >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {trade.pnlAmount >= 0 ? '+' : ''}${trade.pnlAmount.toFixed(2)} ({trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent}%)
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs text-gray-400 font-mono mb-3 bg-black/20 p-2 rounded">
              <div>Stock Entry: ${trade.entryStockPrice}</div>
              <div>Stock Exit: ${trade.exitStockPrice}</div>
              <div>Opt Entry: ${trade.optionPremiumEntry}</div>
              <div>Opt Exit: ${trade.optionPremiumExit}</div>
              <div className="text-red-400/80">Comm: -${trade.commissions?.toFixed(2) || '0.00'}</div>
              <div className="text-red-400/80">Slip: -${trade.slippage?.toFixed(2) || '0.00'}</div>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed">
              <span className="text-terminal-accent">Analysis:</span> {trade.rationale}
            </p>
          </div>
        ))}
      </div>

       {/* Source Grounding */}
       {groundingChunks && groundingChunks.length > 0 && (
          <div className="mt-4 bg-black border border-gray-800 rounded-lg p-4">
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sources</h4>
             <div className="flex flex-wrap gap-2">
               {groundingChunks.map((chunk, i) => chunk.web?.uri ? (
                 <a 
                  key={i} 
                  href={chunk.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-xs"
                 >
                   {chunk.web.title || new URL(chunk.web.uri).hostname}
                 </a>
               ) : null)}
             </div>
          </div>
        )}

      <div className="mt-6 p-4 rounded-lg bg-yellow-900/10 border border-yellow-900/30 text-center">
            <p className="text-xs text-yellow-600/80">
              <strong>Disclaimer:</strong> Backtest results are simulated. Net P/L includes estimated commissions and slippage, but past performance is not indicative of future results.
            </p>
      </div>
    </div>
  );
};
