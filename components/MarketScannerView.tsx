import React, { useState, useEffect, useMemo } from 'react';
import { runMarketScanner } from '../services/gemini';
import { MarketScannerResponse, MarketScannerOption, MarketScannerStock } from '../types';
import { useAuth } from '../FirebaseProvider';
import { saveRunToDatabase } from '../services/historyService';
import { exportAsPDF, exportAsJSON, exportAsTextReport, exportAsCSV, printDocument } from '../services/exportUtils';
import { 
  Search, Loader2, TrendingUp, TrendingDown, Minus, Briefcase, Zap, 
  BookmarkCheck, Save, Download, FileText, FileSpreadsheet, FileCode, 
  Printer, ShieldCheck, Scale, ArrowUpRight, CheckCircle2,
  Calendar, Layers, Filter, Sparkles, BarChart2, Activity,
  ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, Table as TableIcon,
  Gauge, Flame, SlidersHorizontal, ChevronRight, Info
} from 'lucide-react';

interface MarketScannerViewProps {
  initialData?: MarketScannerResponse | null;
  onNavigateToStrategyBuilder?: (ticker: string, initialStrategy?: any) => void;
  onNavigateToPredictor?: (ticker: string) => void;
}

type OptionsSortKey = 'ivPercentile' | 'predictedMomentum' | 'riskRewardRatio' | 'probabilityOfProfit' | 'ticker' | 'strategy' | 'expiration' | 'sentiment';
type StocksSortKey = 'predictedMomentum' | 'ivPercentile' | 'ticker' | 'sentiment' | 'name' | 'sector';

// Helper to extract numerical IV Percentile from option or stock
export const extractIVPercentile = (item: MarketScannerOption | MarketScannerStock): number => {
  if (item.ivPercentile !== undefined && !isNaN(item.ivPercentile)) {
    return Number(item.ivPercentile);
  }
  if ('ivRank' in item && item.ivRank) {
    const match = item.ivRank.match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return 50;
};

// Helper to extract numerical Predicted Momentum score (-100 to +100)
export const extractMomentumScore = (item: MarketScannerOption | MarketScannerStock): number => {
  if (item.predictedMomentum !== undefined && !isNaN(item.predictedMomentum)) {
    return Number(item.predictedMomentum);
  }
  const sentiment = item.sentiment;
  if (sentiment === 'BULLISH') return 75;
  if (sentiment === 'BEARISH') return -65;
  return 10;
};

// Helper to extract numerical Risk:Reward ratio (e.g. "1 : 3.8" -> 3.8)
export const extractRiskRewardNumber = (option: MarketScannerOption): number => {
  if (!option.riskRewardRatio) return 2.5;
  const parts = option.riskRewardRatio.split(':');
  if (parts.length > 1) {
    const num = parseFloat(parts[1].trim());
    if (!isNaN(num)) return num;
  }
  const match = option.riskRewardRatio.match(/(\d+(?:\.\d+)?)/g);
  if (match && match.length > 1) return parseFloat(match[1]);
  if (match && match.length === 1) return parseFloat(match[0]);
  return 2.5;
};

// Helper to extract numerical Win Rate / PoP (e.g. "68%" -> 68)
export const extractPoPNumber = (option: MarketScannerOption): number => {
  if (!option.probabilityOfProfit) return 60;
  const match = option.probabilityOfProfit.match(/(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  return 60;
};

export const MarketScannerView: React.FC<MarketScannerViewProps> = ({ 
  initialData,
  onNavigateToStrategyBuilder,
  onNavigateToPredictor
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MarketScannerResponse | null>(initialData || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [optionsCategoryFilter, setOptionsCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sorting & View Mode State for Options
  const [optionsSortKey, setOptionsSortKey] = useState<OptionsSortKey>('ivPercentile');
  const [optionsSortDirection, setOptionsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [optionsViewMode, setOptionsViewMode] = useState<'table' | 'cards'>('table');

  // Sorting & View Mode State for Stocks
  const [stocksSortKey, setStocksSortKey] = useState<StocksSortKey>('predictedMomentum');
  const [stocksSortDirection, setStocksSortDirection] = useState<'asc' | 'desc'>('desc');
  const [stocksViewMode, setStocksViewMode] = useState<'table' | 'cards'>('table');

  // Row expand state for details
  const [expandedOptionTicker, setExpandedOptionTicker] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  const handleScan = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const response = await runMarketScanner();
      setData(response.result);
    } catch (error) {
      console.error(error);
      alert("Failed to run market scan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!user) {
      alert("Please sign in to save scans to your database.");
      return;
    }
    if (!data) return;
    setSaving(true);
    try {
      await saveRunToDatabase(user.uid, {
        ticker: 'MARKET_SCAN',
        mode: 'MARKET_SCANNER',
        title: 'Top 10 Stocks & Options Scan',
        result: data
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save scan to database.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle sorting on Options column
  const handleOptionsSort = (key: OptionsSortKey) => {
    if (optionsSortKey === key) {
      setOptionsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOptionsSortKey(key);
      // Default to ascending for IV rank (buyers want low IV) or descending for momentum / RR / PoP
      if (key === 'ivPercentile') {
        setOptionsSortDirection('asc');
      } else {
        setOptionsSortDirection('desc');
      }
    }
  };

  // Toggle sorting on Stocks column
  const handleStocksSort = (key: StocksSortKey) => {
    if (stocksSortKey === key) {
      setStocksSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setStocksSortKey(key);
      setStocksSortDirection('desc');
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (sentiment === 'BULLISH') {
      return (
        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 text-[11px] font-bold rounded-md inline-flex items-center gap-1">
          <TrendingUp size={12} /> Bullish
        </span>
      );
    }
    if (sentiment === 'BEARISH') {
      return (
        <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 text-[11px] font-bold rounded-md inline-flex items-center gap-1">
          <TrendingDown size={12} /> Bearish
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 border border-gray-500/30 text-[11px] font-bold rounded-md inline-flex items-center gap-1">
        <Minus size={12} /> Neutral
      </span>
    );
  };

  const getCategoryBadge = (category?: string, strategyName?: string) => {
    const cat = category || (strategyName?.toLowerCase().includes('condor') || strategyName?.toLowerCase().includes('credit') ? 'HIGH_PROBABILITY_INCOME' : strategyName?.toLowerCase().includes('leaps') || strategyName?.toLowerCase().includes('long') ? 'DIRECTIONAL_LEAPS' : 'DEFINED_RISK_SPREAD');
    
    switch (cat) {
      case 'DEFINED_RISK_SPREAD':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">Defined Risk Spread</span>;
      case 'DIRECTIONAL_LEAPS':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">1-6 Mo LEAPS/Swing</span>;
      case 'HIGH_PROBABILITY_INCOME':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">High PoP Income</span>;
      case 'ASYMMETRIC_BUTTERFLY':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">Asymmetric Butterfly</span>;
      case 'CALENDAR_DIAGONAL':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Diagonal / Calendar</span>;
      default:
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-300">Quantitative Setup</span>;
    }
  };

  // Render IV Percentile Meter Bar
  const renderIVMeter = (iv: number) => {
    let colorClass = 'bg-cyan-400';
    let textClass = 'text-cyan-300';
    let label = 'Low (Buyer Edge)';
    if (iv >= 60) {
      colorClass = 'bg-rose-400';
      textClass = 'text-rose-300';
      label = 'Elevated (Seller Edge)';
    } else if (iv >= 35) {
      colorClass = 'bg-amber-400';
      textClass = 'text-amber-300';
      label = 'Moderate Vol';
    }

    return (
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className={`font-bold ${textClass}`}>{iv}% IV</span>
          <span className="text-[9px] text-gray-400 truncate max-w-[75px]">{label}</span>
        </div>
        <div className="w-full bg-gray-800/80 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-full ${colorClass} transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(5, iv))}%` }}
          />
        </div>
      </div>
    );
  };

  // Render Momentum Score Gauge
  const renderMomentumBadge = (momentum: number) => {
    const isBull = momentum > 25;
    const isBear = momentum < -25;
    const absVal = Math.abs(momentum);

    let badgeClass = "bg-green-500/15 text-green-400 border-green-500/30";
    let Icon = TrendingUp;
    let label = "Bullish";

    if (isBear) {
      badgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      Icon = TrendingDown;
      label = "Bearish";
    } else if (!isBull) {
      badgeClass = "bg-blue-500/15 text-blue-400 border-blue-500/30";
      Icon = Minus;
      label = "Rangebound";
    }

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${badgeClass}`}>
        <Icon size={13} />
        <span>{momentum > 0 ? `+${momentum}%` : `${momentum}%`}</span>
        <span className="text-[10px] opacity-80 uppercase tracking-tighter">({label})</span>
      </div>
    );
  };

  // Filtered & Sorted Options
  const sortedAndFilteredOptions = useMemo(() => {
    if (!data?.options) return [];
    
    // 1. Filter
    const filtered = data.options.filter(opt => {
      const matchSearch = searchTerm === '' || 
        opt.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
        opt.strategy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchSearch) return false;

      if (optionsCategoryFilter === 'ALL') return true;
      if (optionsCategoryFilter === 'DEFINED_RISK') return opt.category === 'DEFINED_RISK_SPREAD' || opt.strategy.toLowerCase().includes('spread');
      if (optionsCategoryFilter === 'LEAPS_SWINGS') return opt.category === 'DIRECTIONAL_LEAPS' || opt.strategy.toLowerCase().includes('long call') || opt.strategy.toLowerCase().includes('leaps');
      if (optionsCategoryFilter === 'INCOME') return opt.category === 'HIGH_PROBABILITY_INCOME' || opt.strategy.toLowerCase().includes('condor') || opt.strategy.toLowerCase().includes('credit') || opt.strategy.toLowerCase().includes('lizard');
      if (optionsCategoryFilter === 'ASYMMETRIC') return opt.category === 'ASYMMETRIC_BUTTERFLY' || opt.strategy.toLowerCase().includes('butterfly');
      if (optionsCategoryFilter === 'DIAGONAL') return opt.category === 'CALENDAR_DIAGONAL' || opt.strategy.toLowerCase().includes('diagonal') || opt.strategy.toLowerCase().includes('pmcc');
      return true;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (optionsSortKey) {
        case 'ivPercentile':
          comparison = extractIVPercentile(a) - extractIVPercentile(b);
          break;
        case 'predictedMomentum':
          comparison = extractMomentumScore(a) - extractMomentumScore(b);
          break;
        case 'riskRewardRatio':
          comparison = extractRiskRewardNumber(a) - extractRiskRewardNumber(b);
          break;
        case 'probabilityOfProfit':
          comparison = extractPoPNumber(a) - extractPoPNumber(b);
          break;
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'strategy':
          comparison = a.strategy.localeCompare(b.strategy);
          break;
        case 'expiration':
          comparison = a.expiration.localeCompare(b.expiration);
          break;
        case 'sentiment':
          comparison = (a.sentiment || '').localeCompare(b.sentiment || '');
          break;
        default:
          comparison = 0;
      }
      return optionsSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data?.options, optionsCategoryFilter, searchTerm, optionsSortKey, optionsSortDirection]);

  // Filtered & Sorted Stocks
  const sortedAndFilteredStocks = useMemo(() => {
    if (!data?.stocks) return [];

    const filtered = data.stocks.filter(stk => {
      return searchTerm === '' || 
        stk.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
        stk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stk.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stk.sector && stk.sector.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (stocksSortKey) {
        case 'predictedMomentum':
          comparison = extractMomentumScore(a) - extractMomentumScore(b);
          break;
        case 'ivPercentile':
          comparison = extractIVPercentile(a) - extractIVPercentile(b);
          break;
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'sector':
          comparison = (a.sector || '').localeCompare(b.sector || '');
          break;
        case 'sentiment':
          comparison = a.sentiment.localeCompare(b.sentiment);
          break;
        default:
          comparison = 0;
      }
      return stocksSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data?.stocks, searchTerm, stocksSortKey, stocksSortDirection]);

  const exportPayload = {
    ticker: 'MARKET_SCAN',
    mode: 'MARKET_SCANNER',
    title: 'Top 10 Stocks & Options Scan (Institutional Quantitative Model)',
    result: data
  };

  // Sort Header Component for Table
  const SortableHeader = ({ 
    label, 
    sortKey, 
    currentKey, 
    direction, 
    onClick,
    align = 'left' 
  }: { 
    label: string; 
    sortKey: any; 
    currentKey: any; 
    direction: 'asc' | 'desc'; 
    onClick: (k: any) => void;
    align?: 'left' | 'center' | 'right';
  }) => {
    const isActive = currentKey === sortKey;
    return (
      <th 
        onClick={() => onClick(sortKey)}
        className={`py-3.5 px-4 font-mono text-xs uppercase tracking-wider font-bold cursor-pointer select-none transition-colors border-b border-gray-800 ${
          isActive 
            ? 'text-terminal-accent bg-terminal-accent/5' 
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
        } text-${align}`}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isActive ? (
            direction === 'asc' ? <ArrowUp size={13} className="text-terminal-accent" /> : <ArrowDown size={13} className="text-terminal-accent" />
          ) : (
            <ArrowUpDown size={12} className="text-gray-600 opacity-60 group-hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-6 animate-in fade-in pb-16 space-y-8">
      {/* Header & Scan Trigger */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-br from-[#0c0d10] via-[#090a0c] to-[#040405] p-6 rounded-2xl border border-gray-800/80 shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-terminal-accent/10 border border-terminal-accent/30 text-terminal-accent text-xs font-mono font-bold flex items-center gap-1.5">
              <Sparkles size={12} /> Deep Quantitative Research & Web Grounding
            </span>
          </div>
          <h2 className="text-3xl font-black flex items-center gap-3 text-white">
            <Search className="text-terminal-accent" size={32} /> Institutional Market Scanner
          </h2>
          <p className="text-gray-400 text-sm max-w-3xl leading-relaxed">
            Autonomous multi-strategy scanning engine targeting high <strong>Risk-to-Reward ratios (R:R)</strong>, 
            optimal <strong>1 to 6-month swing/LEAPS cycles (30 to 180 DTE)</strong>, Volatility Risk Premium (VRP) mispricings, and upcoming catalyst horizons.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button 
            onClick={handleScan}
            disabled={loading}
            className="bg-terminal-accent text-black px-7 py-3 rounded-xl font-black hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-terminal-accent/10 cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
            {loading ? "Researching Deep Markets..." : "Run Quantitative Scan"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-[#0c0d10]/40 border border-gray-800/50 rounded-2xl">
          <div className="relative">
            <Loader2 size={56} className="animate-spin text-terminal-accent" />
            <Activity size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-pulse" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <p className="text-xl font-bold text-white">Synthesizing Market Intelligence</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Scanning real-time news, calculating Implied Volatility Percentiles (IVP), assessing directional momentum vectors, optimizing 1–6 month option expirations, and screening for asymmetric 1:3+ risk-to-reward setups...
            </p>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-10">
          
          {/* Action & Export Toolbar */}
          <div className="bg-[#0b0c0e] border border-gray-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs font-mono text-gray-300">
                10 Stocks & 10 Options Researched • <strong className="text-white">Sortable Multi-Column Matrix</strong>
              </span>
            </div>

            {/* Filter Search Input */}
            <div className="flex-1 max-w-xs relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ticker, strategy, catalyst..."
                className="w-full bg-black/60 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-terminal-accent font-mono"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSaveToDb}
                disabled={saving || saved}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  saved 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-terminal-accent text-black hover:bg-white'
                }`}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <BookmarkCheck size={13} /> : <Save size={13} />}
                {saved ? "Saved" : "Save to DB"}
              </button>

              <span className="text-gray-800">|</span>

              <button 
                onClick={() => exportAsPDF(exportPayload)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-500/40 text-xs text-sky-300 font-bold rounded-lg transition-all shadow-sm group"
                title="Export Formatted PDF Screener Report"
              >
                <Download size={13} className="text-sky-400 group-hover:translate-y-0.5 transition-transform" />
                <span>PDF Report</span>
              </button>

              <button 
                onClick={() => exportAsTextReport(exportPayload)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
                title="Export Text Report"
              >
                <FileText size={13} className="text-blue-400" /> .TXT
              </button>

              <button 
                onClick={() => exportAsCSV(exportPayload)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
                title="Export CSV Table"
              >
                <FileSpreadsheet size={13} className="text-green-400" /> CSV
              </button>

              <button 
                onClick={() => exportAsJSON(exportPayload)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
                title="Export JSON"
              >
                <FileCode size={13} className="text-yellow-400" /> JSON
              </button>

              <button 
                onClick={() => printDocument(exportPayload)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
                title="Print / PDF"
              >
                <Printer size={13} className="text-purple-400" /> Print
              </button>
            </div>
          </div>

          {/* Quick Ranking & Sorting Control Bar */}
          <div className="bg-[#101216] border border-gray-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-terminal-accent" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
                  Quick Rank Presets:
                </span>
              </div>

              {/* Preset Rank Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setOptionsSortKey('ivPercentile'); setOptionsSortDirection('asc'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    optionsSortKey === 'ivPercentile' && optionsSortDirection === 'asc'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                      : 'bg-black/60 text-gray-400 hover:text-cyan-300 border border-gray-800'
                  }`}
                >
                  <Gauge size={13} className="text-cyan-400" />
                  <span>⚡ Lowest IV Percentile (Debit/LEAPS Edge)</span>
                </button>

                <button
                  onClick={() => { setOptionsSortKey('ivPercentile'); setOptionsSortDirection('desc'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    optionsSortKey === 'ivPercentile' && optionsSortDirection === 'desc'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                      : 'bg-black/60 text-gray-400 hover:text-rose-300 border border-gray-800'
                  }`}
                >
                  <Flame size={13} className="text-rose-400" />
                  <span>🔥 Highest IV (Credit/Premium Capture)</span>
                </button>

                <button
                  onClick={() => { setOptionsSortKey('predictedMomentum'); setOptionsSortDirection('desc'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    optionsSortKey === 'predictedMomentum' && optionsSortDirection === 'desc'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                      : 'bg-black/60 text-gray-400 hover:text-emerald-300 border border-gray-800'
                  }`}
                >
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>🚀 Highest Predicted Momentum</span>
                </button>

                <button
                  onClick={() => { setOptionsSortKey('riskRewardRatio'); setOptionsSortDirection('desc'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    optionsSortKey === 'riskRewardRatio' && optionsSortDirection === 'desc'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                      : 'bg-black/60 text-gray-400 hover:text-purple-300 border border-gray-800'
                  }`}
                >
                  <Scale size={13} className="text-purple-400" />
                  <span>🎯 Highest Risk : Reward (R:R)</span>
                </button>

                <button
                  onClick={() => { setOptionsSortKey('probabilityOfProfit'); setOptionsSortDirection('desc'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    optionsSortKey === 'probabilityOfProfit' && optionsSortDirection === 'desc'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                      : 'bg-black/60 text-gray-400 hover:text-sky-300 border border-gray-800'
                  }`}
                >
                  <ShieldCheck size={13} className="text-sky-400" />
                  <span>🛡️ Highest Win Rate (PoP)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Top 10 Options Strategies Section */}
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-2xl font-black flex items-center gap-2.5 text-white">
                  <Briefcase className="text-terminal-accent" size={24} /> Top 10 Options Strategies
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Rank potential derivatives trades by clicking table columns (<strong>IV Percentile</strong>, <strong>Momentum</strong>, <strong>R:R</strong>, <strong>PoP</strong>) or using preset filters.
                </p>
              </div>

              {/* Strategy Category Filter Chips & View Mode Toggle */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                  {[
                    { id: 'ALL', label: 'All Setups' },
                    { id: 'DEFINED_RISK', label: 'Vertical Spreads' },
                    { id: 'LEAPS_SWINGS', label: '1-6 Mo LEAPS' },
                    { id: 'INCOME', label: 'High PoP Income' },
                    { id: 'ASYMMETRIC', label: 'Butterflies' },
                    { id: 'DIAGONAL', label: 'Diagonals' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setOptionsCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-colors ${
                        optionsCategoryFilter === cat.id
                          ? 'bg-terminal-accent text-black font-bold'
                          : 'bg-[#121316] text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Table vs Cards Toggle */}
                <div className="flex items-center bg-black/60 border border-gray-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => setOptionsViewMode('table')}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all ${
                      optionsViewMode === 'table' 
                        ? 'bg-terminal-accent text-black font-bold' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Interactive Sortable Table View"
                  >
                    <TableIcon size={13} />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    onClick={() => setOptionsViewMode('cards')}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all ${
                      optionsViewMode === 'cards' 
                        ? 'bg-terminal-accent text-black font-bold' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Visual Card Grid View"
                  >
                    <LayoutGrid size={13} />
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TABLE VIEW FOR OPTIONS */}
            {optionsViewMode === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0c0d10] shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121418] border-b border-gray-800">
                      <SortableHeader 
                        label="Ticker / Setup" 
                        sortKey="ticker" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <SortableHeader 
                        label="IV Percentile (IVP)" 
                        sortKey="ivPercentile" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <SortableHeader 
                        label="Predicted Momentum" 
                        sortKey="predictedMomentum" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <SortableHeader 
                        label="Risk : Reward" 
                        sortKey="riskRewardRatio" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <SortableHeader 
                        label="Win Rate (PoP)" 
                        sortKey="probabilityOfProfit" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <SortableHeader 
                        label="Expiration (30-180D)" 
                        sortKey="expiration" 
                        currentKey={optionsSortKey} 
                        direction={optionsSortDirection} 
                        onClick={handleOptionsSort} 
                      />
                      <th className="py-3.5 px-4 font-mono text-xs uppercase tracking-wider font-bold text-gray-400 border-b border-gray-800 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-xs">
                    {sortedAndFilteredOptions.map((option, idx) => {
                      const ivVal = extractIVPercentile(option);
                      const momVal = extractMomentumScore(option);
                      const isExpanded = expandedOptionTicker === `${option.ticker}_${idx}`;

                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                              isExpanded ? 'bg-terminal-accent/[0.03]' : ''
                            }`}
                            onClick={() => setExpandedOptionTicker(isExpanded ? null : `${option.ticker}_${idx}`)}
                          >
                            {/* Ticker & Strategy */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-black text-white font-mono">{option.ticker}</span>
                                    {getSentimentBadge(option.sentiment)}
                                  </div>
                                  <span className="text-xs font-bold text-sky-400 font-sans mt-0.5">{option.strategy}</span>
                                  <div className="mt-1">
                                    {getCategoryBadge(option.category, option.strategy)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* IV Percentile */}
                            <td className="py-3 px-4">
                              {renderIVMeter(ivVal)}
                              {option.ivRank && (
                                <span className="text-[10px] text-gray-500 block mt-1 truncate max-w-[150px]">
                                  {option.ivRank}
                                </span>
                              )}
                            </td>

                            {/* Predicted Momentum */}
                            <td className="py-3 px-4">
                              {renderMomentumBadge(momVal)}
                              {option.expectedMove && (
                                <span className="text-[10px] text-gray-400 block mt-1">
                                  Exp Move: <strong className="text-gray-300">{option.expectedMove}</strong>
                                </span>
                              )}
                            </td>

                            {/* Risk:Reward Ratio */}
                            <td className="py-3 px-4">
                              <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                {option.riskRewardRatio || "1 : 3.5"}
                              </span>
                              {option.maxProfit && (
                                <span className="text-[10px] text-gray-500 block mt-1 truncate max-w-[120px]">
                                  Max: {option.maxProfit}
                                </span>
                              )}
                            </td>

                            {/* Win Rate (PoP) */}
                            <td className="py-3 px-4">
                              <span className="text-sm font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                                {option.probabilityOfProfit || "65%"}
                              </span>
                              {option.breakeven && (
                                <span className="text-[10px] text-gray-500 block mt-1 truncate max-w-[120px]">
                                  BE: {option.breakeven}
                                </span>
                              )}
                            </td>

                            {/* Strikes & Expiration */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-amber-300">{option.expiration}</span>
                                <span className="text-[11px] text-gray-300 mt-0.5">Strikes: <strong>{option.strike}</strong></span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {onNavigateToStrategyBuilder && (
                                  <button
                                    onClick={() => onNavigateToStrategyBuilder(option.ticker, {
                                      ticker: option.ticker,
                                      strategyName: option.strategy,
                                      strike: option.strike,
                                      expiration: option.expiration
                                    })}
                                    className="px-2.5 py-1 bg-terminal-accent/10 hover:bg-terminal-accent hover:text-black text-terminal-accent text-xs font-bold rounded-md border border-terminal-accent/30 transition-all flex items-center gap-1"
                                    title="Open in Strategy Builder"
                                  >
                                    <Layers size={12} /> Build
                                  </button>
                                )}

                                {onNavigateToPredictor && (
                                  <button
                                    onClick={() => onNavigateToPredictor(option.ticker)}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-md border border-gray-700 transition-all flex items-center gap-1"
                                    title="Simulate with Monte Carlo & Quantitative Predictor"
                                  >
                                    <ArrowUpRight size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Accordion Expanded Row Details */}
                          {isExpanded && (
                            <tr className="bg-[#0e1014] border-b border-gray-800/80">
                              <td colSpan={7} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs bg-black/40 p-4 rounded-xl border border-gray-800">
                                  <div className="md:col-span-2 space-y-2">
                                    <div className="flex items-center gap-1.5 text-terminal-accent font-mono font-bold uppercase text-[11px]">
                                      <Info size={13} /> Institutional Volatility & Structure Thesis
                                    </div>
                                    <p className="text-gray-300 leading-relaxed text-xs">
                                      {option.reason}
                                    </p>
                                  </div>

                                  <div className="space-y-2 font-mono text-xs border-t md:border-t-0 md:border-l border-gray-800 md:pl-4">
                                    {option.catalystHorizon && (
                                      <div className="flex items-start gap-1.5 text-amber-300">
                                        <Calendar size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span><strong>Catalyst:</strong> {option.catalystHorizon}</span>
                                      </div>
                                    )}
                                    {option.maxRisk && (
                                      <div className="text-gray-400">
                                        Max Defined Risk: <span className="text-red-400 font-bold">{option.maxRisk}</span>
                                      </div>
                                    )}
                                    {option.breakeven && (
                                      <div className="text-gray-400">
                                        Breakeven Price: <span className="text-white font-bold">{option.breakeven}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* CARD GRID VIEW FOR OPTIONS */}
            {optionsViewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {sortedAndFilteredOptions.map((option, idx) => {
                  const ivVal = extractIVPercentile(option);
                  const momVal = extractMomentumScore(option);

                  return (
                    <div 
                      key={idx} 
                      className="bg-gradient-to-b from-[#111215] to-[#0b0c0e] border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-all flex flex-col justify-between relative group hover:shadow-xl hover:shadow-black/60"
                    >
                      {/* Top Bar: Ticker, Category, Sentiment */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-white font-mono tracking-tight">{option.ticker}</span>
                              {getSentimentBadge(option.sentiment || 'BULLISH')}
                            </div>
                            <p className="text-xs font-bold text-sky-400 mt-1">{option.strategy}</p>
                          </div>

                          <div>
                            {getCategoryBadge(option.category, option.strategy)}
                          </div>
                        </div>

                        {/* Quantitative IV Percentile & Momentum Gauge Strip */}
                        <div className="grid grid-cols-2 gap-2 bg-black/60 p-2.5 rounded-lg border border-gray-800/80 items-center">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">IV Percentile</span>
                            {renderIVMeter(ivVal)}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Momentum</span>
                            {renderMomentumBadge(momVal)}
                          </div>
                        </div>

                        {/* Risk to Reward & PoP Highlighting */}
                        <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-lg border border-gray-800/60">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider flex items-center gap-1">
                              <Scale size={10} className="text-emerald-400" /> Risk / Reward
                            </span>
                            <span className="text-sm font-black font-mono text-emerald-400">
                              {option.riskRewardRatio || "1 : 3.5"}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider flex items-center gap-1">
                              <ShieldCheck size={10} className="text-sky-400" /> Win Rate (PoP)
                            </span>
                            <span className="text-sm font-black font-mono text-sky-400">
                              {option.probabilityOfProfit || "65%"}
                            </span>
                          </div>
                        </div>

                        {/* Strikes & Expiration Specs */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="bg-[#16171b] p-2 rounded border border-gray-800">
                            <span className="text-[10px] text-gray-500 block uppercase">Strike(s)</span>
                            <span className="text-white font-bold">{option.strike}</span>
                          </div>
                          <div className="bg-[#16171b] p-2 rounded border border-gray-800">
                            <span className="text-[10px] text-gray-500 block uppercase">Exp (30-180D)</span>
                            <span className="text-amber-300 font-bold">{option.expiration}</span>
                          </div>
                        </div>

                        {/* Institutional Thesis */}
                        <div className="pt-1">
                          <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                            {option.reason}
                          </p>
                        </div>

                        {/* Catalyst Horizon */}
                        {option.catalystHorizon && (
                          <div className="bg-amber-500/5 border border-amber-500/20 p-2 rounded-lg text-xs flex items-center gap-1.5 text-amber-300">
                            <Calendar size={12} className="text-amber-400 flex-shrink-0" />
                            <span className="font-mono text-[11px] truncate">Catalyst: {option.catalystHorizon}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-4 mt-3 border-t border-gray-800/80 flex items-center gap-2">
                        {onNavigateToStrategyBuilder && (
                          <button
                            onClick={() => onNavigateToStrategyBuilder(option.ticker, {
                              ticker: option.ticker,
                              strategyName: option.strategy,
                              strike: option.strike,
                              expiration: option.expiration
                            })}
                            className="flex-1 py-1.5 bg-terminal-accent/10 hover:bg-terminal-accent hover:text-black text-terminal-accent text-xs font-bold rounded-lg border border-terminal-accent/30 transition-all flex items-center justify-center gap-1"
                          >
                            <Layers size={13} /> Build Strategy
                          </button>
                        )}

                        {onNavigateToPredictor && (
                          <button
                            onClick={() => onNavigateToPredictor(option.ticker)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition-all flex items-center gap-1"
                            title="Simulate with Monte Carlo & Quantitative Predictor"
                          >
                            <ArrowUpRight size={13} /> Predict
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sortedAndFilteredOptions.length === 0 && (
              <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                No option setups match your filter criteria.
              </div>
            )}
          </div>

          {/* Top 10 Stocks Section */}
          <div className="space-y-5 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-2xl font-black flex items-center gap-2.5 text-white">
                  <TrendingUp className="text-terminal-accent" size={24} /> Top 10 High-Conviction Stock Setups
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Rank equities by <strong>Predicted Momentum</strong>, <strong>IV Percentile</strong>, or sector accumulation.
                </p>
              </div>

              {/* Stock Table vs Cards Toggle */}
              <div className="flex items-center bg-black/60 border border-gray-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setStocksViewMode('table')}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all ${
                    stocksViewMode === 'table' 
                      ? 'bg-terminal-accent text-black font-bold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Sortable Table View"
                >
                  <TableIcon size={13} />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setStocksViewMode('cards')}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all ${
                    stocksViewMode === 'cards' 
                      ? 'bg-terminal-accent text-black font-bold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>

            {/* STOCKS TABLE VIEW */}
            {stocksViewMode === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0c0d10] shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121418] border-b border-gray-800">
                      <SortableHeader 
                        label="Ticker / Company" 
                        sortKey="ticker" 
                        currentKey={stocksSortKey} 
                        direction={stocksSortDirection} 
                        onClick={handleStocksSort} 
                      />
                      <SortableHeader 
                        label="Predicted Momentum" 
                        sortKey="predictedMomentum" 
                        currentKey={stocksSortKey} 
                        direction={stocksSortDirection} 
                        onClick={handleStocksSort} 
                      />
                      <SortableHeader 
                        label="IV Percentile" 
                        sortKey="ivPercentile" 
                        currentKey={stocksSortKey} 
                        direction={stocksSortDirection} 
                        onClick={handleStocksSort} 
                      />
                      <SortableHeader 
                        label="Sector" 
                        sortKey="sector" 
                        currentKey={stocksSortKey} 
                        direction={stocksSortDirection} 
                        onClick={handleStocksSort} 
                      />
                      <th className="py-3.5 px-4 font-mono text-xs uppercase tracking-wider font-bold text-gray-400 border-b border-gray-800">
                        Technical Setup & Catalyst
                      </th>
                      <th className="py-3.5 px-4 font-mono text-xs uppercase tracking-wider font-bold text-gray-400 border-b border-gray-800 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-xs">
                    {sortedAndFilteredStocks.map((stock, idx) => {
                      const momVal = extractMomentumScore(stock);
                      const ivVal = extractIVPercentile(stock);

                      return (
                        <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                          {/* Ticker & Name */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-black text-white font-mono">{stock.ticker}</span>
                                {getSentimentBadge(stock.sentiment)}
                              </div>
                              <span className="text-xs text-gray-400 font-sans mt-0.5">{stock.name}</span>
                            </div>
                          </td>

                          {/* Predicted Momentum */}
                          <td className="py-3 px-4">
                            {renderMomentumBadge(momVal)}
                          </td>

                          {/* IV Percentile */}
                          <td className="py-3 px-4">
                            {renderIVMeter(ivVal)}
                          </td>

                          {/* Sector */}
                          <td className="py-3 px-4">
                            {stock.sector ? (
                              <span className="text-[11px] font-mono px-2 py-0.5 bg-white/5 border border-gray-800 text-gray-300 rounded">
                                {stock.sector}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>

                          {/* Technical Setup & Catalyst */}
                          <td className="py-3 px-4 font-sans text-xs">
                            <div className="space-y-1 max-w-md">
                              {stock.technicalSetup && (
                                <p className="text-gray-300 font-mono text-[11px]">
                                  <strong className="text-terminal-accent font-sans">Setup:</strong> {stock.technicalSetup}
                                </p>
                              )}
                              <p className="text-amber-300/90 text-[11px]">
                                <strong>Catalyst:</strong> {stock.catalyst}
                              </p>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onNavigateToStrategyBuilder && (
                                <button
                                  onClick={() => onNavigateToStrategyBuilder(stock.ticker)}
                                  className="px-2.5 py-1 bg-terminal-accent/10 hover:bg-terminal-accent hover:text-black text-terminal-accent text-xs font-bold rounded-md border border-terminal-accent/30 transition-all flex items-center gap-1"
                                  title="Build Options Strategy"
                                >
                                  <Layers size={12} /> Options
                                </button>
                              )}

                              {onNavigateToPredictor && (
                                <button
                                  onClick={() => onNavigateToPredictor(stock.ticker)}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-md border border-gray-700 transition-all flex items-center gap-1"
                                  title="Predict Monte Carlo Paths"
                                >
                                  <ArrowUpRight size={12} /> Predict
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* STOCKS CARD VIEW */}
            {stocksViewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedAndFilteredStocks.map((stock, idx) => {
                  const momVal = extractMomentumScore(stock);
                  const ivVal = extractIVPercentile(stock);

                  return (
                    <div 
                      key={idx} 
                      className="bg-gradient-to-b from-[#111215] to-[#0b0c0e] border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-all flex flex-col justify-between relative group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-2xl text-white font-mono">{stock.ticker}</h4>
                              {getSentimentBadge(stock.sentiment)}
                            </div>
                            <p className="text-xs text-gray-400 font-medium">{stock.name}</p>
                          </div>

                          {stock.sector && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-white/5 border border-gray-800 text-gray-400 rounded">
                              {stock.sector}
                            </span>
                          )}
                        </div>

                        {/* Momentum & IV Percentile Meter */}
                        <div className="grid grid-cols-2 gap-2 bg-black/60 p-2.5 rounded-lg border border-gray-800/80 items-center">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Momentum</span>
                            {renderMomentumBadge(momVal)}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">IV Percentile</span>
                            {renderIVMeter(ivVal)}
                          </div>
                        </div>

                        {stock.technicalSetup && (
                          <div className="bg-[#16171b] p-2.5 rounded-lg border border-gray-800/80">
                            <span className="text-[10px] text-gray-500 uppercase font-mono block mb-0.5 flex items-center gap-1">
                              <BarChart2 size={10} className="text-terminal-accent" /> Technical Setup
                            </span>
                            <p className="text-xs text-gray-200 font-mono">{stock.technicalSetup}</p>
                          </div>
                        )}

                        <div className="flex-1">
                          <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                            {stock.reason}
                          </p>
                        </div>

                        <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/60">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1">
                            <Calendar size={10} className="text-amber-400" /> Key Catalyst
                          </p>
                          <p className="text-xs text-amber-200/90 font-medium">{stock.catalyst}</p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-gray-800 flex items-center gap-2">
                        {onNavigateToStrategyBuilder && (
                          <button
                            onClick={() => onNavigateToStrategyBuilder(stock.ticker)}
                            className="flex-1 py-1.5 bg-terminal-accent/10 hover:bg-terminal-accent hover:text-black text-terminal-accent text-xs font-bold rounded-lg border border-terminal-accent/30 transition-all flex items-center justify-center gap-1"
                          >
                            <Layers size={13} /> Options
                          </button>
                        )}

                        {onNavigateToPredictor && (
                          <button
                            onClick={() => onNavigateToPredictor(stock.ticker)}
                            className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition-all flex items-center justify-center gap-1"
                          >
                            <ArrowUpRight size={13} /> Predict
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sortedAndFilteredStocks.length === 0 && (
              <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                No stock setups match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
