import React, { useState } from 'react';
import { NewsAnalysis, NewsHeadlineItem } from '../types';
import { fetchTickerNewsAndSentiment } from '../services/gemini';
import { 
  Newspaper, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  RefreshCw, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  ShieldAlert, 
  Activity, 
  Flame, 
  Layers, 
  Clock, 
  Search,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';

interface TickerNewsFeedProps {
  ticker: string;
  currentPrice?: number;
  initialNews?: NewsAnalysis;
}

export const TickerNewsFeed: React.FC<TickerNewsFeedProps> = ({ 
  ticker, 
  currentPrice, 
  initialNews 
}) => {
  const [news, setNews] = useState<NewsAnalysis | null>(initialNews || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'HIGH_VOL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fetchTickerNewsAndSentiment(ticker, currentPrice);
      setNews(updated);
    } catch (err: any) {
      console.error('Failed to fetch news feed:', err);
      setError('Unable to refresh live financial news. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If no news data exists yet and not loading, fetch on demand
  React.useEffect(() => {
    if (!news && !loading) {
      handleRefresh();
    }
  }, [ticker]);

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-terminal-green/20 text-terminal-green border border-terminal-green/40">
            <TrendingUp size={12} /> BULLISH
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-terminal-red/20 text-terminal-red border border-terminal-red/40">
            <TrendingDown size={12} /> BEARISH
          </span>
        );
      case 'MIXED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Activity size={12} /> MIXED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
            <Minus size={12} /> NEUTRAL
          </span>
        );
    }
  };

  const getVolBiasBadge = (bias: string) => {
    switch (bias) {
      case 'EXPANDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
            <Flame size={12} className="animate-pulse" /> IV EXPANDING
          </span>
        );
      case 'CRUSHING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Zap size={12} /> IV CRUSH RISK
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <ShieldAlert size={12} /> IV ELEVATED
          </span>
        );
      case 'COMPRESSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            <Layers size={12} /> IV COMPRESSED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-700/40 text-gray-300 border border-gray-600">
            <Activity size={12} /> IV STABLE
          </span>
        );
    }
  };

  const getVolImpactBadge = (impact: string) => {
    switch (impact) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            <Flame size={10} /> HIGH VOL IMPACT
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            MED VOL IMPACT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-800 text-gray-400 border border-gray-700">
            LOW VOL IMPACT
          </span>
        );
    }
  };

  const headlines: NewsHeadlineItem[] = news?.keyHeadlines || [];

  const filteredHeadlines = headlines.filter(item => {
    const matchesSearch = searchQuery.trim() === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keyTakeaway.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterSentiment === 'ALL') return true;
    if (filterSentiment === 'HIGH_VOL') return item.volatilityImpact === 'HIGH';
    return item.sentiment === filterSentiment;
  });

  return (
    <div id="ticker-news-feed" className="bg-[#0c0c0e] border border-gray-800 rounded-xl overflow-hidden shadow-2xl mt-8">
      {/* Top Header Bar */}
      <div className="p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-[#121216] to-[#0c0c0e] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Newspaper size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Live News & Sentiment Intelligence
                <span className="text-xs font-mono font-normal text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
                  {ticker.toUpperCase()}
                </span>
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Sparkles size={12} className="text-yellow-400" />
              Grounded in real-time Google Search financial telemetry & options skew analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {news?.lastUpdated && (
            <span className="text-xs font-mono text-gray-500 flex items-center gap-1 hidden sm:inline-flex">
              <Clock size={12} /> {news.lastUpdated}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            title="Fetch latest Google Search news headlines and recompute volatility sentiment"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : "text-gray-400"} />
            <span>{loading ? "Searching..." : "Refresh News"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border-b border-red-900/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !news && (
        <div className="p-8 text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-spin mb-2">
            <RefreshCw size={24} />
          </div>
          <h4 className="text-sm font-bold text-gray-200">Conducting Live Google Search for {ticker}...</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Retrieving recent breaking news, analyst ratings, and option volatility drivers across major financial news wires.
          </p>
        </div>
      )}

      {news && (
        <div className="p-6 space-y-6">
          {/* Executive AI Sentiment & Volatility Impact Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Market Sentiment Summary */}
            <div className="p-5 rounded-xl bg-[#131318] border border-gray-800/80 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-white pointer-events-none">
                <Sparkles size={80} />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Activity size={14} className="text-terminal-accent" />
                    Market Sentiment Consensus
                  </span>
                  {getSentimentBadge(news.overallSentiment)}
                </div>

                {/* Sentiment Meter Bar */}
                <div className="mb-4 bg-black/60 p-3 rounded-lg border border-gray-800">
                  <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1.5">
                    <span className="text-red-400">Bearish (-100%)</span>
                    <span className="text-white font-bold">
                      Score: {news.sentimentScore > 0 ? `+${news.sentimentScore}` : news.sentimentScore}%
                    </span>
                    <span className="text-green-400">Bullish (+100%)</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full transition-all duration-700 ${
                        news.sentimentScore >= 20 
                          ? 'bg-gradient-to-r from-green-600 to-terminal-green' 
                          : news.sentimentScore <= -20 
                          ? 'bg-gradient-to-r from-red-600 to-rose-400' 
                          : 'bg-gradient-to-r from-yellow-500 to-amber-400'
                      }`}
                      style={{ 
                        width: `${Math.min(100, Math.max(5, ((news.sentimentScore + 100) / 200) * 100))}%` 
                      }}
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {news.sentimentSummary}
                </p>
              </div>
            </div>

            {/* Volatility & Options Impact Summary */}
            <div className="p-5 rounded-xl bg-[#131318] border border-gray-800/80 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-white pointer-events-none">
                <Flame size={80} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-400" />
                    Implied Volatility (IV) & Option Impact
                  </span>
                  {getVolBiasBadge(news.impliedVolatilityBias)}
                </div>

                <div className="mb-4 bg-orange-950/20 border border-orange-900/40 p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 rounded-md bg-orange-500/20 text-orange-400 shrink-0">
                    <Zap size={16} />
                  </div>
                  <div className="text-xs text-orange-200/90 leading-tight">
                    <strong>Options Pricing Bias:</strong> {news.impliedVolatilityBias === 'EXPANDING' ? 'Premiums expanding due to upcoming catalyst demand; favor defined-risk directional long options or Vega exposure.' : news.impliedVolatilityBias === 'CRUSHING' ? 'Post-event implied volatility compression likely; beware of post-earnings Theta/Vega decay.' : 'Balanced implied volatility regime; standard historical volatility parity pricing.'}
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {news.volatilityImpactSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Key Upcoming Catalyst Triggers */}
          {news.catalystTriggers && news.catalystTriggers.length > 0 && (
            <div className="p-4 rounded-xl bg-black/40 border border-gray-800">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <CalendarDays size={14} className="text-yellow-400" />
                Key News & Event Catalyst Triggers
              </div>
              <div className="flex flex-wrap gap-2">
                {news.catalystTriggers.map((trig, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-950/30 text-yellow-300 border border-yellow-800/40 rounded-lg text-xs font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    {trig}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filter and Search Bar for Headlines */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 mr-1">Filter:</span>
              <button
                onClick={() => setFilterSentiment('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterSentiment === 'ALL' 
                    ? 'bg-terminal-accent text-black' 
                    : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                All ({headlines.length})
              </button>
              <button
                onClick={() => setFilterSentiment('BULLISH')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterSentiment === 'BULLISH' 
                    ? 'bg-green-500 text-black' 
                    : 'bg-gray-900 text-gray-400 hover:text-green-300 border border-gray-800'
                }`}
              >
                Bullish
              </button>
              <button
                onClick={() => setFilterSentiment('BEARISH')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterSentiment === 'BEARISH' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:text-red-300 border border-gray-800'
                }`}
              >
                Bearish
              </button>
              <button
                onClick={() => setFilterSentiment('HIGH_VOL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterSentiment === 'HIGH_VOL' 
                    ? 'bg-orange-500 text-black' 
                    : 'bg-gray-900 text-gray-400 hover:text-orange-300 border border-gray-800'
                }`}
              >
                High Vol Impact
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search headlines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-black/60 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Headlines Feed List */}
          <div className="space-y-3">
            {filteredHeadlines.length === 0 ? (
              <div className="p-8 text-center bg-black/20 border border-gray-800 rounded-xl text-gray-500 text-xs">
                No headlines match the current filter or search criteria.
              </div>
            ) : (
              filteredHeadlines.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-xl bg-[#111116] hover:bg-[#15151c] border border-gray-800 hover:border-gray-700 transition-all duration-200 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-sky-400 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded">
                        {item.source}
                      </span>
                      {item.timeAgo && (
                        <span className="text-[11px] font-mono text-gray-500">
                          • {item.timeAgo}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {getSentimentBadge(item.sentiment)}
                      {getVolImpactBadge(item.volatilityImpact)}
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors mb-1.5">
                    {item.url ? (
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        {item.title}
                        <ExternalLink size={13} className="opacity-60 group-hover:opacity-100 shrink-0" />
                      </a>
                    ) : (
                      item.title
                    )}
                  </h4>

                  {item.snippet && (
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  )}

                  {/* AI Volatility Takeaway Pill */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-black/50 border border-gray-800/90 flex items-start gap-2 text-xs">
                    <Sparkles size={14} className="text-terminal-accent shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-300">Options & Volatility Takeaway: </span>
                      <span className="text-gray-400">{item.keyTakeaway}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Source Grounding Web URLs */}
          {news.groundingChunks && news.groundingChunks.length > 0 && (
            <div className="p-4 rounded-xl bg-black/40 border border-gray-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                <CheckCircle2 size={13} className="text-sky-400" />
                Google Search Grounding Sources ({news.groundingChunks.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {news.groundingChunks.map((chunk, i) => chunk.web?.uri ? (
                  <a
                    key={i}
                    href={chunk.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs text-sky-400 hover:text-sky-300 transition-colors truncate max-w-xs"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{chunk.web.title || new URL(chunk.web.uri).hostname}</span>
                  </a>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
