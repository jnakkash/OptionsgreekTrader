import React, { useState } from 'react';
import { AnalysisResponse } from '../types';
import { GreeksCard } from './GreeksCard';
import { TickerNewsFeed } from './TickerNewsFeed';
import { VolatilitySurfacePlot } from './VolatilitySurfacePlot';
import { useAuth } from '../FirebaseProvider';
import { saveRunToDatabase } from '../services/historyService';
import { exportAsPDF, exportAsJSON, exportAsTextReport, exportAsCSV, printDocument } from '../services/exportUtils';
import { TrendingUp, AlertTriangle, Calendar, Target, Save, BookmarkCheck, FileText, FileSpreadsheet, FileCode, Printer, Loader2, Download, ShieldCheck } from 'lucide-react';

interface AnalysisViewProps {
  data: AnalysisResponse;
  reset: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ data, reset }) => {
  const { user } = useAuth();
  const { recommendation, groundingChunks, newsAnalysis } = data;
  const isCall = recommendation.strategy === 'Long Call';
  const colorClass = isCall ? 'text-terminal-green' : 'text-terminal-red';
  const bgClass = isCall ? 'bg-terminal-green/10' : 'bg-terminal-red/10';
  const borderClass = isCall ? 'border-terminal-green/30' : 'border-terminal-red/30';

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveToDb = async () => {
    if (!user) {
      alert("Please sign in to save analysis to your database.");
      return;
    }
    setSaving(true);
    try {
      await saveRunToDatabase(user.uid, {
        ticker: recommendation.ticker,
        mode: 'LIVE',
        title: `${recommendation.ticker} ${recommendation.strategy} Analysis`,
        result: data
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save analysis to database.");
    } finally {
      setSaving(false);
    }
  };

  const exportPayload = {
    ticker: recommendation.ticker,
    mode: 'LIVE',
    title: `${recommendation.ticker} Options Analysis Report`,
    result: data
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            {recommendation.ticker}
            <span className="text-lg font-mono font-normal text-gray-400 px-3 py-1 bg-gray-800 rounded-full">
              ${recommendation.currentPrice.toFixed(2)}
            </span>
          </h2>
          <p className="text-gray-400 mt-1">Market Analysis & Strategy Recommendation</p>
        </div>
        <button 
          onClick={reset}
          className="px-4 py-2 text-sm font-mono text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
        >
          Analyze New Ticker
        </button>
      </div>

      {/* Save & Export Toolbar */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-white font-bold">
          <span className="w-2 h-2 rounded-full bg-terminal-accent animate-ping" />
          <span>Analysis Ready</span>
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
            title="Export Formatted PDF Report for External Review"
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

      {/* Main Strategy Card */}
      <div className={`p-6 rounded-xl border ${borderClass} ${bgClass} mb-8 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4 opacity-10">
          {isCall ? <TrendingUp size={120} /> : <TrendingUp size={120} className="transform rotate-180"/>}
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-mono text-sm font-bold uppercase tracking-wider ${colorClass} border ${borderClass} px-2 py-0.5 rounded`}>
              Recommended Strategy
            </span>
          </div>
          
          <h1 className={`text-4xl md:text-5xl font-bold text-white mb-6 flex flex-wrap items-center gap-x-4 gap-y-2`}>
            <span className={colorClass}>{recommendation.strategy.toUpperCase()}</span>
            <span className="text-gray-600">@</span>
            <span className="font-mono text-white">${recommendation.strikePrice}</span>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-black/40 rounded-lg border border-gray-700">
                <Calendar className="text-blue-400 mb-1" size={20} />
                <div className="text-xs text-gray-500 uppercase">Expiration</div>
                <div className="text-lg font-mono font-bold">{recommendation.expirationDate}</div>
              </div>
              <div className="p-3 bg-black/40 rounded-lg border border-gray-700">
                <Target className="text-purple-400 mb-1" size={20} />
                <div className="text-xs text-gray-500 uppercase">Target Strike</div>
                <div className="text-lg font-mono font-bold">${recommendation.strikePrice}</div>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 text-yellow-500 font-mono text-sm mb-1">
                <AlertTriangle size={14} /> Risk Profile
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                {recommendation.riskProfile}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Rationale & Analysis */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-terminal-gray border border-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-terminal-accent rounded-full"></span>
              Expert Rationale
            </h3>
            <p className="text-gray-300 leading-relaxed text-base whitespace-pre-line">
              {recommendation.rationale}
            </p>

            {recommendation.catalysts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Key Catalysts</h4>
                <ul className="space-y-2">
                  {recommendation.catalysts.map((cat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-terminal-accent mt-1">•</span>
                      {cat}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Source Grounding */}
          {groundingChunks && groundingChunks.length > 0 && (
            <div className="bg-black border border-gray-800 rounded-lg p-4">
               <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recommendation Sources</h4>
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
        </div>

        {/* Sidebar: Greeks */}
        <div className="lg:col-span-1">
          <GreeksCard greeks={recommendation.greeks} />
          
          <div className="mt-6 p-4 rounded-lg bg-yellow-900/10 border border-yellow-900/30">
            <p className="text-xs text-yellow-600/80">
              <strong>Disclaimer:</strong> This application is for educational purposes only. Options trading involves significant risk and is not suitable for all investors. The Greeks and prices shown are estimates based on AI analysis of market data and may not reflect real-time brokerage feeds.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive D3 Volatility Surface & Smile Plot */}
      <div className="mt-8">
        <VolatilitySurfacePlot recommendation={recommendation} />
      </div>

      {/* Real-time News Feed & Sentiment Analysis Component */}
      <TickerNewsFeed 
        ticker={recommendation.ticker} 
        currentPrice={recommendation.currentPrice}
        initialNews={newsAnalysis}
      />
    </div>
  );
};

