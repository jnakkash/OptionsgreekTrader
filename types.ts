import type { QuantitativeAnalysisResult } from './services/backtestEngine';

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
}

export interface Recommendation {
  ticker: string;
  currentPrice: number;
  strategy: 'Long Call' | 'Long Put';
  strikePrice: number;
  expirationDate: string;
  rationale: string;
  greeks: Greeks;
  riskProfile: string;
  catalysts: string[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface NewsHeadlineItem {
  title: string;
  source: string;
  snippet?: string;
  url?: string;
  timeAgo?: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatilityImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  keyTakeaway: string;
}

export interface NewsAnalysis {
  ticker: string;
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  sentimentScore: number; // -100 to +100 (%)
  sentimentSummary: string;
  volatilityImpactSummary: string; // Explains impact on IV, implied move, skew, tail risk, and options pricing
  impliedVolatilityBias: 'EXPANDING' | 'CRUSHING' | 'ELEVATED' | 'COMPRESSED' | 'STABLE';
  keyHeadlines: NewsHeadlineItem[];
  catalystTriggers: string[];
  lastUpdated?: string;
  groundingChunks?: GroundingChunk[];
}

export interface AnalysisResponse {
  recommendation: Recommendation;
  groundingChunks?: GroundingChunk[];
  newsAnalysis?: NewsAnalysis;
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  type: 'Call' | 'Put';
  strike: number;
  entryStockPrice: number;
  exitStockPrice: number;
  optionPremiumEntry: number;
  optionPremiumExit: number;
  commissions: number;
  slippage: number;
  pnlPercent: number;
  pnlAmount: number; // Net P/L
  rationale: string;
}

export interface BacktestResult {
  ticker: string;
  period: string;
  strategy: {
    name: string;
    parameters: string[];
  };
  totalPnl: number;
  winRate: number;
  trades: BacktestTrade[];
  summary: string;
}

export interface BacktestResponse {
  result: BacktestResult;
  groundingChunks?: GroundingChunk[];
}

export enum LoadingState {
  IDLE = 'IDLE',
  ANALYZING_MARKET = 'ANALYZING_MARKET',
  CALCULATING_GREEKS = 'CALCULATING_GREEKS',
  RUNNING_BACKTEST = 'RUNNING_BACKTEST',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export type AppMode = 'LIVE' | 'BACKTEST' | 'HISTORY' | 'SANDBOX' | 'AWESOME_QUANT' | 'MARKET_SCANNER' | 'PREDICTOR' | 'STRATEGY_BUILDER';

export interface MarketScannerStock {
  ticker: string;
  name: string;
  reason: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  catalyst: string;
  sector?: string;
  technicalSetup?: string;
  ivPercentile?: number;
  predictedMomentum?: number;
  momentumLabel?: string;
}

export interface MarketScannerOption {
  ticker: string;
  strategy: string;
  strike: string;
  expiration: string;
  reason: string;
  riskRewardRatio?: string;
  probabilityOfProfit?: string;
  ivRank?: string;
  ivPercentile?: number;
  predictedMomentum?: number;
  expectedMove?: string;
  breakeven?: string;
  maxProfit?: string;
  maxRisk?: string;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  category?: 'DIRECTIONAL_LEAPS' | 'DEFINED_RISK_SPREAD' | 'HIGH_PROBABILITY_INCOME' | 'VOLATILITY_EXPANSION' | 'CALENDAR_DIAGONAL' | 'ASYMMETRIC_BUTTERFLY';
  catalystHorizon?: string;
}

export interface MarketScannerResponse {
  stocks: MarketScannerStock[];
  options: MarketScannerOption[];
  groundingChunks?: GroundingChunk[];
}

export interface PredictionResponse {
  ticker: string;
  currentPrice: number;
  hedgeFundAnalysis: string;
  quantAnalysis?: QuantitativeAnalysisResult;
  groundingChunks?: GroundingChunk[];
}