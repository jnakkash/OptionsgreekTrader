import React, { useState } from 'react';
import { Search, Loader2, Activity, History, LineChart, Code2, Library, Database, Bookmark } from 'lucide-react';
import { analyzeTicker, runBacktest } from './services/gemini';
import { AnalysisResponse, BacktestResponse, MarketScannerResponse, PredictionResponse, LoadingState, AppMode } from './types';
import { AnalysisView } from './components/AnalysisView';
import { BacktestView } from './components/BacktestView';
import { HistoryView } from './components/HistoryView';
import { QuantSandboxView } from './components/QuantSandboxView';
import { AwesomeQuantView } from './components/AwesomeQuantView';
import { MarketScannerView } from './components/MarketScannerView';
import { PredictionEngineView } from './components/PredictionEngineView';
import { StrategyBuilderView } from './components/StrategyBuilderView';
import { QuantToolsSidebar } from './components/QuantToolsSidebar';
import { useAuth } from './FirebaseProvider';
import { saveRunToDatabase } from './services/historyService';

export default function App() {
  const { user, loading, authError, signIn, logOut } = useAuth();
  const [mode, setMode] = useState<AppMode>('LIVE');
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('Last 6 Months');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [isQuantToolsOpen, setIsQuantToolsOpen] = useState(false);
  const [sandboxCode, setSandboxCode] = useState('');
  
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [backtestData, setBacktestData] = useState<BacktestResponse | null>(null);
  const [predictorData, setPredictorData] = useState<PredictionResponse | null>(null);
  const [scannerData, setScannerData] = useState<MarketScannerResponse | null>(null);
  const [strategyData, setStrategyData] = useState<any | null>(null);
  
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setLoadingState(mode === 'LIVE' ? LoadingState.ANALYZING_MARKET : LoadingState.RUNNING_BACKTEST);
    setError(null);
    setAnalysisData(null);
    setBacktestData(null);

    try {
      let resultData;
      if (mode === 'LIVE') {
        // UX Simulation
        setTimeout(() => {
          if(loadingState === LoadingState.ANALYZING_MARKET) {
             setLoadingState(LoadingState.CALCULATING_GREEKS);
          }
        }, 2000);

        const result = await analyzeTicker(ticker);
        setAnalysisData(result);
        resultData = result;
      } else {
        // Backtest Mode
        const result = await runBacktest(ticker, period);
        setBacktestData(result);
        resultData = result;
      }
      setLoadingState(LoadingState.COMPLETE);

      if (user) {
        try {
          await saveRunToDatabase(user.uid, {
            ticker: ticker.toUpperCase(),
            mode: mode,
            title: `${ticker.toUpperCase()} ${mode === 'LIVE' ? 'Live Options Analysis' : 'Backtest Simulation'}`,
            result: resultData
          });
        } catch (e) {
          console.error("Error saving to Firebase:", e);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to process request. Please check the ticker symbol and try again.");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const getLoadingMessage = () => {
    switch (loadingState) {
      case LoadingState.ANALYZING_MARKET:
        return "Scanning real-time market data...";
      case LoadingState.CALCULATING_GREEKS:
        return "Calculating Greeks and optimizing strike prices...";
      case LoadingState.RUNNING_BACKTEST:
        return `Simulating historical trades for ${period}...`;
      default:
        return "Processing...";
    }
  };

  const resetApp = () => {
    setLoadingState(LoadingState.IDLE);
    setTicker('');
    setAnalysisData(null);
    setBacktestData(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-terminal-accent selection:text-black">
      <QuantToolsSidebar 
        isOpen={isQuantToolsOpen} 
        onClose={() => setIsQuantToolsOpen(false)} 
        onSelectTool={(code) => {
          setSandboxCode(code);
          setMode('SANDBOX');
        }}
      />
      
      {/* Navbar */}
      <nav className="border-b border-gray-900 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <div className="w-8 h-8 bg-terminal-accent rounded-lg flex items-center justify-center text-black font-bold font-mono">
              <Activity size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight">OptiGreek<span className="text-gray-500 font-light">Advisor</span></span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:block text-xs text-gray-500 font-mono">
               POWERED BY GEMINI PRO
            </div>
            <button 
              onClick={() => setMode('HISTORY')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded transition-all ${
                mode === 'HISTORY' ? 'bg-terminal-accent text-black' : 'text-terminal-accent bg-terminal-accent/10 border border-terminal-accent/30 hover:bg-terminal-accent hover:text-black'
              }`}
            >
              <Database size={14} /> Memory Hub
            </button>
            <button 
              onClick={() => setIsQuantToolsOpen(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-terminal-accent transition-colors"
            >
              <Code2 size={14} /> Quant Tools
            </button>
            {!loading && (
              user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">{user.email}</span>
                  <button onClick={logOut} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded transition-colors">
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <button onClick={signIn} className="text-xs bg-terminal-accent text-black font-bold px-4 py-1.5 rounded hover:bg-white transition-colors">
                    Sign In
                  </button>
                  {authError && (
                    <span className="text-[10px] text-red-400 max-w-[220px] text-right leading-tight">{authError}</span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {loadingState === LoadingState.IDLE && !analysisData && !backtestData && (
           <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto animate-in fade-in zoom-in duration-500">
             <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent tracking-tighter">
               Master the Greeks.
             </h1>
             <p className="text-xl text-gray-400 mb-8 leading-relaxed">
               {mode === 'LIVE' 
                 ? "AI-powered real-time options analysis. We calculate Delta, Gamma, and Theta to find the perfect strike."
                 : "Simulate strategies against historical data. Backtest probability of profit using past market conditions."}
             </p>

             {/* Mode Switcher */}
             <div className="bg-[#0f0f0f] p-1 rounded-lg border border-gray-800 flex flex-wrap gap-1 mb-8 w-full max-w-3xl">
               <button 
                onClick={() => setMode('LIVE')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'LIVE' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <Activity size={14} /> Live Analysis
               </button>
               <button 
                onClick={() => setMode('BACKTEST')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'BACKTEST' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <LineChart size={14} /> Backtest
               </button>
               <button 
                onClick={() => setMode('HISTORY')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'HISTORY' ? 'bg-emerald-400 text-black shadow-lg font-extrabold' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
               >
                 <Database size={14} /> Memory Hub
               </button>
               <button 
                onClick={() => setMode('MARKET_SCANNER')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'MARKET_SCANNER' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <Search size={14} /> Scanner
               </button>
               <button 
                onClick={() => setMode('PREDICTOR')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'PREDICTOR' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <Activity size={14} /> Predictor
               </button>
               <button 
                onClick={() => setMode('STRATEGY_BUILDER')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'STRATEGY_BUILDER' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <LineChart size={14} /> Strategies
               </button>
               <button 
                onClick={() => setMode('SANDBOX')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'SANDBOX' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <Code2 size={14} /> Sandbox
               </button>
               <button 
                onClick={() => setMode('AWESOME_QUANT')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-bold transition-all whitespace-nowrap ${mode === 'AWESOME_QUANT' ? 'bg-terminal-accent text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 <Library size={14} /> Awesome Quant
               </button>
             </div>

             {mode !== 'HISTORY' && mode !== 'SANDBOX' && mode !== 'AWESOME_QUANT' && mode !== 'MARKET_SCANNER' && mode !== 'PREDICTOR' && mode !== 'STRATEGY_BUILDER' && (
               <form onSubmit={handleSearch} className="w-full relative group space-y-4">
                 <div className="relative flex items-center">
                   <Search className="absolute left-4 text-gray-400" size={24} />
                   <input 
                     type="text" 
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value.toUpperCase())}
                     placeholder="Enter Ticker (e.g. AAPL, SPY, NVDA)"
                     className="w-full bg-[#0f0f0f] border border-gray-800 text-white text-lg rounded-lg py-5 pl-14 pr-32 focus:outline-none focus:ring-2 focus:ring-terminal-accent/50 focus:border-transparent transition-all font-mono shadow-2xl"
                   />
                   <button 
                    type="submit"
                    disabled={!ticker}
                    className="absolute right-2 top-2 bottom-2 bg-white text-black font-bold px-6 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {mode === 'LIVE' ? 'ANALYZE' : 'SIMULATE'}
                   </button>
                 </div>

                 {mode === 'BACKTEST' && (
                   <div className="flex gap-2 justify-center">
                     {['Last 3 Months', 'Last 6 Months', 'Last 1 Year'].map((p) => (
                       <button
                         type="button"
                         key={p}
                         onClick={() => setPeriod(p)}
                         className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${period === p ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'}`}
                       >
                         {p.toUpperCase()}
                       </button>
                     ))}
                   </div>
                 )}
               </form>
             )}

             {mode !== 'HISTORY' && mode !== 'SANDBOX' && mode !== 'AWESOME_QUANT' && mode !== 'MARKET_SCANNER' && mode !== 'PREDICTOR' && mode !== 'STRATEGY_BUILDER' && (
               <div className="mt-12 flex gap-4 text-sm text-gray-600 font-mono">
                 <span>SUGGESTED:</span>
                 {['SPY', 'NVDA', 'TSLA', 'AMD'].map(t => (
                   <button key={t} onClick={() => setTicker(t)} className="hover:text-terminal-accent transition-colors">
                     {t}
                   </button>
                 ))}
               </div>
             )}
           </div>
        )}

        {mode === 'MARKET_SCANNER' && (
          <MarketScannerView 
            initialData={scannerData} 
            onNavigateToStrategyBuilder={(t, sData) => {
              setTicker(t);
              if (sData) setStrategyData(sData);
              setMode('STRATEGY_BUILDER');
            }}
            onNavigateToPredictor={(t) => {
              setTicker(t);
              setMode('PREDICTOR');
            }}
          />
        )}
        {mode === 'PREDICTOR' && <PredictionEngineView initialData={predictorData} />}
        {mode === 'STRATEGY_BUILDER' && (
          <StrategyBuilderView 
            initialData={strategyData} 
            onNavigateToPredictor={(t) => {
              setTicker(t);
              setMode('PREDICTOR');
            }}
            onNavigateToBacktest={(t) => {
              setTicker(t);
              setMode('BACKTEST');
            }}
          />
        )}

        {mode === 'SANDBOX' && (
          <QuantSandboxView initialCode={sandboxCode} />
        )}

        {mode === 'AWESOME_QUANT' && (
          <AwesomeQuantView onRunSandbox={(code) => {
            setSandboxCode(code);
            setMode('SANDBOX');
          }} />
        )}

        {(loadingState !== LoadingState.IDLE && loadingState !== LoadingState.COMPLETE && loadingState !== LoadingState.ERROR) && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-terminal-gray border-t-terminal-accent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {mode === 'LIVE' ? <Activity size={24} className="text-terminal-accent animate-pulse" /> : <History size={24} className="text-terminal-accent animate-pulse" />}
              </div>
            </div>
            <h2 className="mt-8 text-xl font-mono text-terminal-accent animate-pulse">
              {getLoadingMessage()}
            </h2>
            <p className="mt-2 text-gray-500 text-sm">
              Connecting to Gemini Pro Intelligence...
            </p>
          </div>
        )}

        {loadingState === LoadingState.ERROR && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="bg-red-500/10 p-4 rounded-full mb-4">
              <Activity className="text-red-500" size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Operation Failed</h2>
            <p className="text-gray-400 mb-8 max-w-md">{error}</p>
            <button 
              onClick={() => setLoadingState(LoadingState.IDLE)}
              className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {mode === 'LIVE' && analysisData && loadingState === LoadingState.COMPLETE && (
          <AnalysisView data={analysisData} reset={resetApp} />
        )}

        {mode === 'BACKTEST' && backtestData && loadingState === LoadingState.COMPLETE && (
          <BacktestView data={backtestData} reset={resetApp} />
        )}

        {mode === 'HISTORY' && (
          <HistoryView onSelect={(loadedMode, data) => {
            setMode(loadedMode);
            if (loadedMode === 'LIVE') {
              setAnalysisData(data);
              setTicker(data?.recommendation?.ticker || data?.ticker || '');
            } else if (loadedMode === 'BACKTEST') {
              setBacktestData(data);
              setTicker(data?.result?.ticker || data?.ticker || '');
            } else if (loadedMode === 'PREDICTOR') {
              setPredictorData(data);
              setTicker(data?.ticker || '');
            } else if (loadedMode === 'MARKET_SCANNER') {
              setScannerData(data);
            } else if (loadedMode === 'STRATEGY_BUILDER') {
              setStrategyData(data);
              setTicker(data?.ticker || '');
            } else if (loadedMode === 'SANDBOX') {
              if (data?.code) {
                setSandboxCode(data.code);
              }
            }
            setLoadingState(LoadingState.COMPLETE);
          }} />
        )}

      </main>
    </div>
  );
}