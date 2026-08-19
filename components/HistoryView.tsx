import React, { useEffect, useState } from 'react';
import { useAuth } from '../FirebaseProvider';
import { fetchUserHistory, deleteHistoryDoc } from '../services/historyService';
import { exportAsPDF, exportAsJSON, exportAsTextReport, exportAsCSV, exportAllHistoryAsCSV, printDocument, ExportableItem } from '../services/exportUtils';
import { 
  Database, Search, Trash2, Download, FileText, FileSpreadsheet, 
  FileCode, Printer, ExternalLink, ChevronDown, ChevronUp, Loader2, Sparkles, Check, Bookmark
} from 'lucide-react';

interface HistoryViewProps {
  onSelect: (mode: any, result: any, ticker: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelect }) => {
  const { user, signIn } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchUserHistory(user.uid);
      setItems(data || []);
    } catch (err) {
      console.error("Error fetching user history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this saved document from database?")) return;

    try {
      await deleteHistoryDoc(user.uid, docId);
      setItems(prev => prev.filter(item => item.id !== docId));
      showToast("Document deleted successfully");
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Failed to delete document from database.");
    }
  };

  const handleBulkExportCSV = () => {
    if (filteredItems.length === 0) {
      alert("No saved items found to export.");
      return;
    }
    exportAllHistoryAsCSV(filteredItems);
    showToast(`Exported ${filteredItems.length} saved document(s) to CSV!`);
  };

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      (item.ticker || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.mode || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === 'ALL') return matchesSearch;
    return matchesSearch && item.mode === activeFilter;
  });

  const formatDate = (ts: any) => {
    if (!ts) return 'Recent';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <Loader2 className="animate-spin text-terminal-accent" size={32} />
        <p className="font-mono text-sm">Opening Memory Hub & loading database records...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16 bg-[#0f0f0f] border border-gray-800 rounded-xl p-8 max-w-xl mx-auto my-8">
        <Database size={48} className="mx-auto text-terminal-accent mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">Memory Hub Database Access</h3>
        <p className="text-gray-400 text-sm mb-6">Sign in to unlock your persistent Memory Hub where all market scans, prediction forecasts, backtest runs, and option strategies are saved and exportable to CSV.</p>
        <button 
          onClick={signIn}
          className="bg-terminal-accent text-black font-bold px-6 py-2.5 rounded-lg hover:bg-white transition-colors"
        >
          Sign In to Access Memory Hub
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-6 animate-in fade-in space-y-6 pb-16">
      
      {/* Toast banner */}
      {actionSuccess && (
        <div className="fixed bottom-6 right-6 bg-terminal-accent text-black font-bold px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-bounce">
          <Check size={18} /> {actionSuccess}
        </div>
      )}

      {/* Header with Memory Hub Title & Bulk Download CSV Button */}
      <div className="bg-gradient-to-r from-[#121212] via-[#161616] to-[#0a0a0a] border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-terminal-accent/10 border border-terminal-accent/30 text-terminal-accent text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
              <Database size={12} /> Database Vault
            </span>
            <span className="text-gray-500 text-xs font-mono">
              Firebase Storage Active
            </span>
          </div>
          <h2 className="text-3xl font-extrabold flex items-center gap-3 text-white">
            <Bookmark className="text-terminal-accent" size={28} /> Memory Hub & Saved Documents
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            Your centralized vault for saved market scans, prediction analyses, backtest runs, and strategy blueprints.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <div className="bg-black/80 border border-gray-800 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-400 flex items-center gap-2">
              <Sparkles size={14} className="text-terminal-accent" />
              <span>Saved Docs: <strong className="text-white">{items.length}</strong></span>
            </div>

            {/* Main CSV Export Button */}
            <button
              onClick={handleBulkExportCSV}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="Iterate through all saved Firebase results and download a formatted CSV file"
            >
              <FileSpreadsheet size={16} /> Download CSV Report
            </button>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
            Exports {filteredItems.length} record(s) directly to CSV
          </span>
        </div>
      </div>

      {/* Controls: Search & Category Tabs */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by ticker, title or mode..."
            className="w-full bg-[#0f0f0f] border border-gray-800 text-white text-sm rounded-lg py-2 pl-9 pr-4 focus:outline-none focus:border-terminal-accent"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1 bg-[#0f0f0f] p-1 border border-gray-800 rounded-lg w-full md:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'MARKET_SCANNER', label: 'Scans' },
            { id: 'LIVE', label: 'Live Analysis' },
            { id: 'PREDICTOR', label: 'Predictor' },
            { id: 'STRATEGY_BUILDER', label: 'Strategies' },
            { id: 'BACKTEST', label: 'Backtests' },
            { id: 'SANDBOX', label: 'Code' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                activeFilter === f.id ? 'bg-terminal-accent text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Item List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-500 font-mono text-sm">
            {items.length === 0 ? "No saved scans or results found yet. Run an analysis or scan and click 'Save to History'!" : "No items match your filter search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map(item => {
            let parsedResult: any;
            try {
              parsedResult = typeof item.result === 'string' ? JSON.parse(item.result) : item.result;
            } catch (e) {
              parsedResult = { raw: item.result };
            }

            const isExpanded = expandedId === item.id;
            const dateStr = formatDate(item.createdAt);

            const exportPayload: ExportableItem = {
              id: item.id,
              ticker: item.ticker,
              mode: item.mode,
              title: item.title,
              createdAt: item.createdAt,
              result: parsedResult
            };

            return (
              <div 
                key={item.id} 
                className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all flex flex-col gap-4"
              >
                {/* Card Top Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-black border border-gray-800 font-mono text-lg font-bold text-white px-3 py-1.5 rounded-lg">
                      {item.ticker || 'SCAN'}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white flex items-center gap-2">
                        {item.title || `${item.ticker} ${item.mode}`}
                      </h4>
                      <span className="text-xs text-gray-500 font-mono">Date Marked: {dateStr}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-mono font-bold tracking-wider ${getModeBadgeStyle(item.mode)}`}>
                      {item.mode}
                    </span>

                    <button 
                      onClick={() => onSelect(item.mode, parsedResult, item.ticker)}
                      className="flex items-center gap-1.5 text-xs bg-white text-black font-bold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Load this result into view"
                    >
                      <ExternalLink size={14} /> Open
                    </button>

                    <button 
                      onClick={(e) => handleDelete(e, item.id)}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete from database"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Export Toolbar */}
                <div className="pt-3 border-t border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500 font-mono flex items-center gap-1 mr-1">
                      <Download size={12} /> Export:
                    </span>

                    <button 
                      onClick={() => exportAsPDF(exportPayload)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-500/40 text-sky-300 font-bold rounded transition-all shadow-sm"
                      title="Export Formatted PDF Report for External Review"
                    >
                      <Download size={12} className="text-sky-400" /> PDF Report
                    </button>
                    
                    <button 
                      onClick={() => exportAsTextReport(exportPayload)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 text-gray-300 rounded transition-colors"
                    >
                      <FileText size={12} className="text-blue-400" /> .TXT
                    </button>

                    <button 
                      onClick={() => exportAsCSV(exportPayload)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 text-gray-300 rounded transition-colors"
                    >
                      <FileSpreadsheet size={12} className="text-green-400" /> CSV (.csv)
                    </button>

                    <button 
                      onClick={() => exportAsJSON(exportPayload)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 text-gray-300 rounded transition-colors"
                    >
                      <FileCode size={12} className="text-yellow-400" /> JSON (.json)
                    </button>

                    <button 
                      onClick={() => printDocument(exportPayload)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 text-gray-300 rounded transition-colors"
                    >
                      <Printer size={12} className="text-purple-400" /> Print / PDF
                    </button>
                  </div>

                  <button 
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-gray-500 hover:text-white flex items-center gap-1 font-mono"
                  >
                    {isExpanded ? <>Hide Details <ChevronUp size={14}/></> : <>Preview Payload <ChevronDown size={14}/></>}
                  </button>
                </div>

                {/* Expanded Preview Drawer */}
                {isExpanded && (
                  <div className="mt-2 bg-black border border-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto">
                    {item.mode === 'PREDICTOR' && parsedResult.hedgeFundAnalysis && (
                      <div className="mb-6 pb-6 border-b border-gray-800 font-sans text-sm text-gray-200">
                        <strong className="text-terminal-accent block mb-2 uppercase text-xs font-mono">Hedge Fund Report Result:</strong>
                        <div className="whitespace-pre-wrap">{parsedResult.hedgeFundAnalysis}</div>
                      </div>
                    )}
                    {item.mode === 'BACKTEST' && parsedResult.result && (
                      <div className="mb-6 pb-6 border-b border-gray-800 font-sans text-sm text-gray-200">
                        <strong className="text-terminal-accent block mb-2 uppercase text-xs font-mono">Backtest Result:</strong>
                        <div className="mb-2"><strong className="text-white">Action:</strong> {parsedResult.result.action}</div>
                        <div className="whitespace-pre-wrap">{parsedResult.result.summary}</div>
                      </div>
                    )}
                    {item.mode === 'LIVE' && parsedResult.recommendation && (
                      <div className="mb-6 pb-6 border-b border-gray-800 font-sans text-sm text-gray-200">
                        <strong className="text-terminal-accent block mb-2 uppercase text-xs font-mono">Analysis Result:</strong>
                        <div className="mb-2"><strong className="text-white">Action:</strong> {parsedResult.recommendation.action}</div>
                        <div className="whitespace-pre-wrap">{parsedResult.recommendation.summary}</div>
                      </div>
                    )}
                    <div className="text-gray-500 uppercase text-[10px] mb-2">Raw JSON Payload</div>
                    <pre className="text-gray-500">{JSON.stringify(parsedResult, null, 2)}</pre>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

const getModeBadgeStyle = (mode: string) => {
  switch (mode) {
    case 'MARKET_SCANNER':
      return 'bg-green-500/10 text-green-400 border border-green-500/30';
    case 'PREDICTOR':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
    case 'STRATEGY_BUILDER':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
    case 'LIVE':
      return 'bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/30';
    case 'BACKTEST':
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
    case 'SANDBOX':
      return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
    default:
      return 'bg-gray-800 text-gray-300';
  }
};
