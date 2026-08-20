import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  Search, Loader2, Plus, Trash2, Target, BrainCircuit, Save, 
  BookmarkCheck, FileText, FileSpreadsheet, FileCode, Printer, 
  Download, Scale, ShieldCheck, TrendingUp, TrendingDown, 
  ChevronUp, ChevronDown, Sparkles, ArrowUpRight, Activity, 
  HelpCircle, RefreshCw, Layers
} from 'lucide-react';
import { fetchCurrentPrice } from '../services/gemini';
import { useAuth } from '../FirebaseProvider';
import { saveRunToDatabase } from '../services/historyService';
import { exportAsPDF, exportAsJSON, exportAsTextReport, exportAsCSV, printDocument } from '../services/exportUtils';
import { getUpcomingMonthlyExpirations, formatDteToMonthlyExpiration } from '../services/expirationUtils';

type OptionType = 'CALL' | 'PUT';
type ActionType = 'BUY' | 'SELL';

interface Leg {
  id: string;
  action: ActionType;
  type: OptionType;
  strike: number;
  qty: number;
  dte: number;
  impliedVol: number;
  expirationDate?: string;
}

// Normal CDF approximation
const N = (x: number) => {
  const b1 =  0.319381530;
  const b2 = -0.356563782;
  const b3 =  1.781477937;
  const b4 = -1.821255978;
  const b5 =  1.330274429;
  const p  =  0.2316419;
  const c  =  0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return (1.0 - c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1));
  } else {
    const t = 1.0 / (1.0 - p * x);
    return (c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1));
  }
};

const N_prime = (x: number) => {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
};

// Black-Scholes Formula
const calculateOption = (S: number, K: number, t: number, r: number, v: number, type: OptionType) => {
  if (t <= 0) {
    return { 
      delta: type === 'CALL' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), 
      gamma: 0, 
      theta: 0, 
      vega: 0, 
      price: Math.max(0, type === 'CALL' ? S - K : K - S) 
    };
  }
  const t_years = Math.max(0.0001, t / 365);
  const vol = Math.max(0.01, v);
  const d1 = (Math.log(S / K) + (r + vol * vol / 2) * t_years) / (vol * Math.sqrt(t_years));
  const d2 = d1 - vol * Math.sqrt(t_years);
  
  let price: number;
  let delta: number;
  let theta: number;
  const gamma = N_prime(d1) / (S * vol * Math.sqrt(t_years));
  const vega = S * N_prime(d1) * Math.sqrt(t_years) / 100;

  if (type === 'CALL') {
    price = S * N(d1) - K * Math.exp(-r * t_years) * N(d2);
    delta = N(d1);
    theta = (- (S * vol * N_prime(d1)) / (2 * Math.sqrt(t_years)) - r * K * Math.exp(-r * t_years) * N(d2)) / 365;
  } else {
    price = K * Math.exp(-r * t_years) * N(-d2) - S * N(-d1);
    delta = N(d1) - 1;
    theta = (- (S * vol * N_prime(d1)) / (2 * Math.sqrt(t_years)) + r * K * Math.exp(-r * t_years) * N(-d2)) / 365;
  }

  return { price: Math.max(0, price), delta, gamma, theta, vega };
};

interface StrategyBuilderViewProps {
  initialData?: any;
  onNavigateToPredictor?: (ticker: string) => void;
  onNavigateToBacktest?: (ticker: string) => void;
}

export const StrategyBuilderView: React.FC<StrategyBuilderViewProps> = ({ 
  initialData,
  onNavigateToPredictor,
  onNavigateToBacktest
}) => {
  const { user } = useAuth();
  const [ticker, setTicker] = useState(initialData?.ticker || 'SPY');
  const [currentPrice, setCurrentPrice] = useState<number | null>(initialData?.currentPrice || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Up to 8 monthly cycles (1 month to 8 months out)
  const monthlyExpirations = useMemo(() => getUpcomingMonthlyExpirations(8), []);
  const m1 = monthlyExpirations[0] || { dte: 35, dateString: 'Sep 18, 2026' };
  const m2 = monthlyExpirations[1] || { dte: 63, dateString: 'Oct 16, 2026' };
  const m3 = monthlyExpirations[2] || { dte: 98, dateString: 'Nov 20, 2026' };
  const m6 = monthlyExpirations[5] || { dte: 189, dateString: 'Feb 19, 2027' };

  const [legs, setLegs] = useState<Leg[]>(initialData?.legs || [
    { 
      id: '1', 
      action: 'BUY', 
      type: 'CALL', 
      strike: 500, 
      qty: 1, 
      dte: m2.dte, // Default 60-day 2-month swing
      expirationDate: m2.dateString,
      impliedVol: 0.22 
    },
    { 
      id: '2', 
      action: 'SELL', 
      type: 'CALL', 
      strike: 515, 
      qty: 1, 
      dte: m2.dte, 
      expirationDate: m2.dateString,
      impliedVol: 0.22 
    }
  ]);

  const loadPrice = async (sym: string) => {
    setLoading(true);
    const p = await fetchCurrentPrice(sym);
    if (p) {
      setCurrentPrice(p);
      // If we only have initial default 500 strikes, center them around real price
      if (legs.length === 2 && legs[0].strike === 500) {
        const rounded = Math.round(p);
        setLegs([
          { ...legs[0], strike: rounded },
          { ...legs[1], strike: rounded + Math.max(5, Math.round(p * 0.03)) }
        ]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialData) {
      if (initialData.ticker) setTicker(initialData.ticker);
      if (initialData.currentPrice) setCurrentPrice(initialData.currentPrice);
      if (initialData.legs) setLegs(initialData.legs);
      if (initialData.strategyName) {
        // Automatically template if strategyName passed
        autoApplyStrategyName(initialData.strategyName, initialData.currentPrice || 500);
      }
    } else {
      loadPrice(ticker);
    }
  }, [initialData]);

  const autoApplyStrategyName = (stratName: string, spot: number) => {
    const s = stratName.toLowerCase();
    if (s.includes('condor')) loadStrategyTemplate('IRON_CONDOR', spot);
    else if (s.includes('butterfly')) loadStrategyTemplate('BROKEN_WING_CALL', spot);
    else if (s.includes('bear put')) loadStrategyTemplate('BEAR_PUT_SPREAD', spot);
    else if (s.includes('bull put') || s.includes('credit')) loadStrategyTemplate('BULL_PUT_CREDIT', spot);
    else if (s.includes('leaps') || (s.includes('long call') && s.includes('6-month'))) loadStrategyTemplate('LONG_CALL_LEAPS', spot);
    else if (s.includes('long call') || s.includes('swing')) loadStrategyTemplate('LONG_CALL_SWING', spot);
    else if (s.includes('diagonal') || s.includes('pmcc')) loadStrategyTemplate('DIAGONAL_PMCC', spot);
    else if (s.includes('lizard')) loadStrategyTemplate('JADE_LIZARD', spot);
    else loadStrategyTemplate('BULL_CALL_SPREAD', spot);
  };

  const handleAddLeg = () => {
    const p = currentPrice ? Math.round(currentPrice) : 100;
    setLegs([...legs, { 
      id: Math.random().toString(), 
      action: 'BUY', 
      type: 'CALL', 
      strike: p, 
      qty: 1, 
      dte: m2.dte, 
      expirationDate: m2.dateString,
      impliedVol: 0.22 
    }]);
  };

  const handleRemoveLeg = (id: string) => {
    setLegs(legs.filter(l => l.id !== id));
  };

  const updateLeg = (id: string, field: keyof Leg, value: any) => {
    setLegs(legs.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'dte') {
        const matchingExp = monthlyExpirations.find(e => e.dte === value);
        if (matchingExp) {
          updated.expirationDate = matchingExp.dateString;
        } else {
          updated.expirationDate = formatDteToMonthlyExpiration(value);
        }
      }
      return updated;
    }));
  };

  // Bulk Strike Shifter
  const shiftAllStrikes = (deltaPct: number) => {
    if (!currentPrice) return;
    const step = Math.max(1, Math.round(currentPrice * 0.01));
    const delta = deltaPct > 0 ? step : -step;
    setLegs(legs.map(l => ({ ...l, strike: Math.max(1, l.strike + delta) })));
  };

  const r = 0.05; // 5% Risk-free rate

  // Advanced Multi-Leg Quantitative Payoff & Risk/Reward Analysis
  const analytics = useMemo(() => {
    if (!currentPrice || legs.length === 0) {
      return { 
        aggregate: null, 
        payoffData: [], 
        maxProfit: 0, 
        maxLoss: 0, 
        riskRewardRatio: '---', 
        pop: 0, 
        breakevens: [],
        expectedValue: 0
      };
    }

    let totalCost = 0;
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    // Calculate Net Greeks & Premium
    legs.forEach(leg => {
      const mult = (leg.action === 'BUY' ? 1 : -1) * leg.qty * 100;
      const metrics = calculateOption(currentPrice, leg.strike, leg.dte, r, leg.impliedVol, leg.type);
      
      totalCost += metrics.price * mult;
      totalDelta += metrics.delta * mult;
      totalGamma += metrics.gamma * mult;
      totalTheta += metrics.theta * mult;
      totalVega += metrics.vega * mult;
    });

    const strikes = legs.map(l => l.strike);
    const minStrike = Math.min(...strikes, currentPrice) * 0.75;
    const maxStrike = Math.max(...strikes, currentPrice) * 1.25;
    const numPoints = 120;
    const step = (maxStrike - minStrike) / numPoints;

    const data: Array<{ price: number; pnl: number; pnlToday: number }> = [];
    let calculatedMaxProfit = -Infinity;
    let calculatedMaxLoss = Infinity;
    const breakevenSet: number[] = [];

    // Max DTE across legs for probability distribution
    const maxDte = Math.max(...legs.map(l => l.dte), 30);
    const avgIV = legs.reduce((acc, l) => acc + l.impliedVol, 0) / legs.length;
    const t_years = maxDte / 365;
    const sigma_sqrt_t = avgIV * Math.sqrt(t_years);
    const mu = Math.log(currentPrice) + (r - 0.5 * avgIV * avgIV) * t_years;

    let totalEvSum = 0;
    let totalProfitableWeight = 0;
    let totalWeight = 0;

    let prevPnl = 0;
    let prevPrice = minStrike;

    for (let p = minStrike; p <= maxStrike; p += step) {
      let pnlExp = 0;
      let pnlToday = 0;

      legs.forEach(leg => {
        const mult = (leg.action === 'BUY' ? 1 : -1) * leg.qty * 100;
        const entryMetrics = calculateOption(currentPrice, leg.strike, leg.dte, r, leg.impliedVol, leg.type);
        const expMetrics = calculateOption(p, leg.strike, 0, r, leg.impliedVol, leg.type);
        const todayMetrics = calculateOption(p, leg.strike, leg.dte, r, leg.impliedVol, leg.type);
        
        pnlExp += (expMetrics.price - entryMetrics.price) * mult;
        pnlToday += (todayMetrics.price - entryMetrics.price) * mult;
      });

      if (pnlExp > calculatedMaxProfit) calculatedMaxProfit = pnlExp;
      if (pnlExp < calculatedMaxLoss) calculatedMaxLoss = pnlExp;

      // Breakeven Zero-Crossing Detection
      if (data.length > 0) {
        if ((prevPnl < 0 && pnlExp >= 0) || (prevPnl > 0 && pnlExp <= 0)) {
          const be = prevPrice + (0 - prevPnl) * (p - prevPrice) / (pnlExp - prevPnl);
          breakevenSet.push(parseFloat(be.toFixed(2)));
        }
      }

      // Log-normal Probability Density
      const logP = Math.log(p);
      const pdf = (1.0 / (p * sigma_sqrt_t * Math.sqrt(2 * Math.PI))) * 
                  Math.exp(-Math.pow(logP - mu, 2) / (2 * sigma_sqrt_t * sigma_sqrt_t));
      
      const weight = pdf * step;
      totalWeight += weight;
      totalEvSum += pnlExp * weight;
      if (pnlExp > 0) {
        totalProfitableWeight += weight;
      }

      prevPnl = pnlExp;
      prevPrice = p;
      data.push({ price: p, pnl: pnlExp, pnlToday });
    }

    const popPct = totalWeight > 0 ? Math.min(99, Math.max(1, Math.round((totalProfitableWeight / totalWeight) * 100))) : 50;
    const ev = totalWeight > 0 ? totalEvSum / totalWeight : 0;

    // Check if ends are unbounded (e.g. naked long call or naked short call)
    const rightPnl = data[data.length - 1]?.pnl || 0;
    const leftPnl = data[0]?.pnl || 0;
    const isUnboundedUpside = rightPnl > 5000 && rightPnl > data[data.length - 5]?.pnl;
    const isUnboundedDownside = leftPnl > 5000 && leftPnl > data[4]?.pnl;

    let rrRatioString = '---';
    if (isUnboundedUpside || isUnboundedDownside) {
      const riskVal = Math.abs(calculatedMaxLoss);
      rrRatioString = riskVal > 0 ? `1 : ∞ (Asymmetric)` : `Unlimited`;
    } else {
      const lossVal = Math.abs(calculatedMaxLoss);
      if (lossVal > 0.1 && calculatedMaxProfit > 0) {
        const ratio = (calculatedMaxProfit / lossVal).toFixed(1);
        rrRatioString = `1 : ${ratio}`;
      } else if (calculatedMaxProfit > 0) {
        rrRatioString = `High R:R`;
      }
    }

    return { 
      aggregate: { 
        cost: totalCost, 
        delta: totalDelta, 
        gamma: totalGamma, 
        theta: totalTheta, 
        vega: totalVega 
      }, 
      payoffData: data,
      maxProfit: calculatedMaxProfit,
      maxLoss: calculatedMaxLoss,
      riskRewardRatio: rrRatioString,
      pop: popPct,
      breakevens: Array.from(new Set(breakevenSet)),
      expectedValue: ev
    };
  }, [currentPrice, legs]);

  // Strategy Template Library with 1-6 Month Monthly Expirations
  const loadStrategyTemplate = (type: string, spotPrice?: number) => {
    const p = spotPrice || (currentPrice ? Math.round(currentPrice) : 500);
    setSaved(false);

    // Standard monthly expirations
    const exp1Mo = m1.dte; // ~35 DTE
    const exp2Mo = m2.dte; // ~63 DTE
    const exp3Mo = m3.dte; // ~98 DTE
    const exp6Mo = m6.dte; // ~189 DTE

    const spreadWidth = Math.max(2.5, Math.round(p * 0.03 * 2) / 2); // ~3% width
    const farWing = spreadWidth * 1.5;

    switch (type) {
      case 'BULL_CALL_SPREAD':
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '2', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 }
        ]);
        break;

      case 'BEAR_PUT_SPREAD':
        setLegs([
          { id: '1', action: 'BUY', type: 'PUT', strike: p, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '2', action: 'SELL', type: 'PUT', strike: p - spreadWidth, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 }
        ]);
        break;

      case 'LONG_CALL_SWING':
        // High convexity 3-month swing
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p, qty: 1, dte: exp3Mo, expirationDate: m3.dateString, impliedVol: 0.20 }
        ]);
        break;

      case 'LONG_CALL_LEAPS':
        // 6-month LEAPS with low daily theta
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p - spreadWidth, qty: 1, dte: exp6Mo, expirationDate: m6.dateString, impliedVol: 0.19 }
        ]);
        break;

      case 'LONG_PUT_HEDGE':
        setLegs([
          { id: '1', action: 'BUY', type: 'PUT', strike: p, qty: 1, dte: exp3Mo, expirationDate: m3.dateString, impliedVol: 0.21 }
        ]);
        break;

      case 'BULL_PUT_CREDIT':
        setLegs([
          { id: '1', action: 'SELL', type: 'PUT', strike: p - spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.24 },
          { id: '2', action: 'BUY', type: 'PUT', strike: p - spreadWidth - spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.25 }
        ]);
        break;

      case 'BEAR_CALL_CREDIT':
        setLegs([
          { id: '1', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.24 },
          { id: '2', action: 'BUY', type: 'CALL', strike: p + spreadWidth + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.25 }
        ]);
        break;

      case 'IRON_CONDOR':
        setLegs([
          { id: '1', action: 'SELL', type: 'PUT', strike: p - spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 },
          { id: '2', action: 'BUY', type: 'PUT', strike: p - spreadWidth - spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.24 },
          { id: '3', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 },
          { id: '4', action: 'BUY', type: 'CALL', strike: p + spreadWidth + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.24 }
        ]);
        break;

      case 'BROKEN_WING_CALL':
        // Asymmetric 1:4.5 R:R Butterfly
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '2', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 2, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '3', action: 'BUY', type: 'CALL', strike: p + (spreadWidth * 2.5), qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.23 }
        ]);
        break;

      case 'JADE_LIZARD':
        setLegs([
          { id: '1', action: 'SELL', type: 'PUT', strike: p - spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.25 },
          { id: '2', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 },
          { id: '3', action: 'BUY', type: 'CALL', strike: p + spreadWidth + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 }
        ]);
        break;

      case 'DIAGONAL_PMCC':
        // Poor Man's Covered Call: Long 6-Mo ITM Call, Short 1-Mo OTM Call
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p - (spreadWidth * 1.5), qty: 1, dte: exp6Mo, expirationDate: m6.dateString, impliedVol: 0.19 },
          { id: '2', action: 'SELL', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 }
        ]);
        break;

      case 'CALENDAR_SPREAD':
        // Time Decay Harvest: Buy 3-Mo ATM Call, Sell 1-Mo ATM Call
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p, qty: 1, dte: exp3Mo, expirationDate: m3.dateString, impliedVol: 0.21 },
          { id: '2', action: 'SELL', type: 'CALL', strike: p, qty: 1, dte: exp1Mo, expirationDate: m1.dateString, impliedVol: 0.23 }
        ]);
        break;

      case 'LONG_STRADDLE':
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '2', action: 'BUY', type: 'PUT', strike: p, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 }
        ]);
        break;

      case 'LONG_STRANGLE':
        setLegs([
          { id: '1', action: 'BUY', type: 'CALL', strike: p + spreadWidth, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 },
          { id: '2', action: 'BUY', type: 'PUT', strike: p - spreadWidth, qty: 1, dte: exp2Mo, expirationDate: m2.dateString, impliedVol: 0.22 }
        ]);
        break;

      default:
        break;
    }
  };

  const handleSaveToDb = async () => {
    if (!user) {
      alert("Please sign in to save strategies to your database.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ticker: ticker.toUpperCase(),
        currentPrice,
        legs,
        aggregate: analytics.aggregate,
        riskRewardRatio: analytics.riskRewardRatio,
        pop: analytics.pop,
        maxProfit: analytics.maxProfit,
        maxLoss: analytics.maxLoss,
        breakevens: analytics.breakevens
      };
      await saveRunToDatabase(user.uid, {
        ticker: ticker.toUpperCase(),
        mode: 'STRATEGY_BUILDER',
        title: `${ticker.toUpperCase()} Multi-Leg Strategy Architecture`,
        result: payload
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save strategy to database.");
    } finally {
      setSaving(false);
    }
  };

  const exportPayload = {
    ticker: ticker.toUpperCase(),
    mode: 'STRATEGY_BUILDER',
    title: `${ticker.toUpperCase()} Multi-Leg Quantitative Strategy Report`,
    result: {
      ticker: ticker.toUpperCase(),
      currentPrice,
      legs,
      aggregate: analytics.aggregate,
      riskRewardRatio: analytics.riskRewardRatio,
      pop: analytics.pop,
      maxProfit: analytics.maxProfit,
      maxLoss: analytics.maxLoss,
      breakevens: analytics.breakevens
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500 pb-16">
      
      {/* Header & Symbol Input */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-[#0c0d10] via-[#090a0c] to-[#040405] p-6 rounded-2xl border border-gray-800/80 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-terminal-accent/10 border border-terminal-accent/30 text-terminal-accent text-xs font-mono font-bold flex items-center gap-1">
              <Sparkles size={12} /> Institutional Volatility & Greek Optimizer
            </span>
          </div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Strategy Architect & Risk-Reward Engine
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Build, optimize, and stress-test multi-leg spreads with real 1–6 month monthly expirations, log-normal win rates, and Black-Scholes Greeks.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onBlur={() => loadPrice(ticker)}
              onKeyDown={(e) => e.key === 'Enter' && loadPrice(ticker)}
              className="bg-black/60 border border-gray-800 text-white rounded-xl py-2.5 pl-10 pr-4 w-36 focus:outline-none focus:border-terminal-accent font-mono font-bold text-sm tracking-wider"
              placeholder="Ticker"
            />
          </div>
          <div className="bg-black/60 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-gray-500 text-xs uppercase font-mono">Spot:</span>
            {loading ? (
              <Loader2 size={16} className="animate-spin text-terminal-accent" />
            ) : (
              <span className="font-bold text-white font-mono text-sm">${currentPrice?.toFixed(2) || '---'}</span>
            )}
          </div>

          {onNavigateToPredictor && (
            <button
              onClick={() => onNavigateToPredictor(ticker)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
              title="Run Monte Carlo Distribution on Ticker"
            >
              <Activity size={14} className="text-terminal-accent" /> Predictor
            </button>
          )}

          {onNavigateToBacktest && (
            <button
              onClick={() => onNavigateToBacktest(ticker)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
              title="Backtest Strategy History"
            >
              <ArrowUpRight size={14} className="text-sky-400" /> Backtest
            </button>
          )}
        </div>
      </div>

      {/* Preset Strategy Library Bar */}
      <div className="bg-[#0b0c0e] border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Target size={14} className="text-terminal-accent" /> Options Strategy Library (1-6 Mo Monthly Expirations):
          </span>
          <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">
            Click any template to auto-configure strikes & optimal monthly DTE
          </span>
        </div>

        {/* Categorized Template Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Directional Bullish / Swings */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-lg border border-gray-800/80">
            <span className="text-[10px] text-green-400 font-mono font-bold uppercase px-1">Bullish:</span>
            <button onClick={() => loadStrategyTemplate('BULL_CALL_SPREAD')} className="px-2.5 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded border border-green-500/30 text-xs font-mono transition-colors">
              Bull Call Spread (60D)
            </button>
            <button onClick={() => loadStrategyTemplate('LONG_CALL_SWING')} className="px-2.5 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded border border-green-500/30 text-xs font-mono transition-colors">
              Long Call 3-Mo Swing (90D)
            </button>
            <button onClick={() => loadStrategyTemplate('LONG_CALL_LEAPS')} className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 text-xs font-mono transition-colors">
              Long Call 6-Mo LEAPS (180D)
            </button>
            <button onClick={() => loadStrategyTemplate('BULL_PUT_CREDIT')} className="px-2.5 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded border border-green-500/30 text-xs font-mono transition-colors">
              Bull Put Credit (35D)
            </button>
          </div>

          {/* Bearish / Hedges */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-lg border border-gray-800/80">
            <span className="text-[10px] text-red-400 font-mono font-bold uppercase px-1">Bearish:</span>
            <button onClick={() => loadStrategyTemplate('BEAR_PUT_SPREAD')} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded border border-red-500/30 text-xs font-mono transition-colors">
              Bear Put Spread (60D)
            </button>
            <button onClick={() => loadStrategyTemplate('LONG_PUT_HEDGE')} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded border border-red-500/30 text-xs font-mono transition-colors">
              Long Put 3-Mo Hedge (90D)
            </button>
            <button onClick={() => loadStrategyTemplate('BEAR_CALL_CREDIT')} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded border border-red-500/30 text-xs font-mono transition-colors">
              Bear Call Credit (35D)
            </button>
          </div>

          {/* High R:R Asymmetric & Neutral */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-lg border border-gray-800/80">
            <span className="text-[10px] text-purple-400 font-mono font-bold uppercase px-1">Asymmetric & Income:</span>
            <button onClick={() => loadStrategyTemplate('BROKEN_WING_CALL')} className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 text-xs font-mono transition-colors">
              Broken Wing Butterfly (1:4.5 R:R)
            </button>
            <button onClick={() => loadStrategyTemplate('IRON_CONDOR')} className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 text-xs font-mono transition-colors">
              Iron Condor (4-Leg)
            </button>
            <button onClick={() => loadStrategyTemplate('JADE_LIZARD')} className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 text-xs font-mono transition-colors">
              Jade Lizard
            </button>
            <button onClick={() => loadStrategyTemplate('DIAGONAL_PMCC')} className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 text-xs font-mono transition-colors">
              Diagonal (PMCC)
            </button>
            <button onClick={() => loadStrategyTemplate('LONG_STRADDLE')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded border border-gray-700 text-xs font-mono transition-colors">
              Long Straddle
            </button>
          </div>
        </div>
      </div>

      {/* Quantitative Decision & Risk/Reward Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Risk / Reward Ratio */}
        <div className="bg-gradient-to-br from-[#111215] to-[#0b0c0e] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5"><Scale size={13} className="text-emerald-400" /> Risk / Reward</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">Target</span>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
              {analytics.riskRewardRatio}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/80 text-[11px] font-mono text-gray-400 flex justify-between">
            <span>Expected Value:</span>
            <span className={`font-bold ${analytics.expectedValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {analytics.expectedValue >= 0 ? `+$${analytics.expectedValue.toFixed(1)}` : `-$${Math.abs(analytics.expectedValue).toFixed(1)}`}
            </span>
          </div>
        </div>

        {/* Card 2: Probability of Profit */}
        <div className="bg-gradient-to-br from-[#111215] to-[#0b0c0e] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-sky-400" /> Win Rate (PoP)</span>
              <span className="text-[10px] text-gray-500 font-mono">Log-Normal</span>
            </div>
            <p className="text-2xl font-black font-mono text-sky-400 mt-1">
              {analytics.pop}%
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/80 text-[11px] font-mono text-gray-400 flex justify-between">
            <span>Breakeven:</span>
            <span className="font-bold text-white">
              {analytics.breakevens.length > 0 ? analytics.breakevens.map(b => `$${b}`).join(', ') : '---'}
            </span>
          </div>
        </div>

        {/* Card 3: Max Profit vs Max Loss */}
        <div className="bg-gradient-to-br from-[#111215] to-[#0b0c0e] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">
              <span>Max Profit / Max Risk</span>
              <span className="text-[10px] text-gray-500 font-mono">At Expiration</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1 font-mono">
              <span className="text-xl font-black text-emerald-400">
                {analytics.maxProfit > 50000 ? 'Unlimited' : `$${analytics.maxProfit.toFixed(0)}`}
              </span>
              <span className="text-gray-600">/</span>
              <span className="text-sm font-bold text-red-400">
                {analytics.maxLoss < -50000 ? 'Unlimited' : `$${Math.abs(analytics.maxLoss).toFixed(0)}`}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/80 text-[11px] font-mono text-gray-400 flex justify-between">
            <span>Entry Capital:</span>
            <span className={`font-bold ${(analytics.aggregate?.cost || 0) < 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {(analytics.aggregate?.cost || 0) < 0 ? `Credit $${Math.abs(analytics.aggregate?.cost || 0).toFixed(0)}` : `Debit $${(analytics.aggregate?.cost || 0).toFixed(0)}`}
            </span>
          </div>
        </div>

        {/* Card 4: Net Delta & Daily Theta */}
        <div className="bg-gradient-to-br from-[#111215] to-[#0b0c0e] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">
              <span>Position Greeks</span>
              <span className="text-[10px] text-gray-500 font-mono">Portfolio</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1 font-mono">
              <div>
                <span className="text-[10px] text-gray-500 block">Delta (Δ)</span>
                <span className={`text-base font-bold ${(analytics.aggregate?.delta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(analytics.aggregate?.delta || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Theta (Θ/day)</span>
                <span className={`text-base font-bold ${(analytics.aggregate?.theta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(analytics.aggregate?.theta || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/80 text-[11px] font-mono text-gray-400 flex justify-between">
            <span>Vega Sensitivity:</span>
            <span className="font-bold text-white">${(analytics.aggregate?.vega || 0).toFixed(2)} / 1% IV</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Legs Config & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Legs Configurator (Col Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Layers size={18} className="text-terminal-accent" /> Strategy Legs
              </h3>
              <span className="text-xs font-mono text-gray-500">({legs.length} Leg{legs.length !== 1 ? 's' : ''})</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Strike Tuners */}
              <button 
                onClick={() => shiftAllStrikes(-1)}
                className="px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 rounded text-xs text-gray-300 font-mono flex items-center gap-1 transition-colors"
                title="Shift all strikes down by 1%"
              >
                <ChevronDown size={14} /> -1% Strikes
              </button>
              <button 
                onClick={() => shiftAllStrikes(1)}
                className="px-2.5 py-1 bg-black hover:bg-gray-800 border border-gray-800 rounded text-xs text-gray-300 font-mono flex items-center gap-1 transition-colors"
                title="Shift all strikes up by 1%"
              >
                <ChevronUp size={14} /> +1% Strikes
              </button>

              <button 
                onClick={handleAddLeg} 
                className="flex items-center gap-1.5 text-xs bg-terminal-accent text-black font-bold px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
              >
                <Plus size={14} /> Add Leg
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {legs.map((leg, i) => (
              <div 
                key={leg.id} 
                className="bg-gradient-to-r from-[#111215] to-[#0d0e11] border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex flex-wrap gap-3 items-end relative shadow-md"
              >
                <div className="absolute top-2 left-2 text-[10px] font-mono font-bold text-terminal-accent bg-terminal-accent/10 px-1.5 py-0.2 rounded border border-terminal-accent/20">
                  L{i+1}
                </div>
                
                {/* Action */}
                <div className="flex flex-col ml-6">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">Action</label>
                  <select 
                    value={leg.action} 
                    onChange={(e) => updateLeg(leg.id, 'action', e.target.value as ActionType)}
                    className={`border rounded px-2.5 py-1.5 text-xs font-bold font-mono outline-none ${
                      leg.action === 'BUY' ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'bg-red-500/10 border-red-500/40 text-red-400'
                    }`}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                
                {/* Qty */}
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">Qty</label>
                  <input 
                    type="number" min="1" max="100"
                    value={leg.qty} 
                    onChange={(e) => updateLeg(leg.id, 'qty', parseInt(e.target.value) || 1)}
                    className="bg-black border border-gray-700 rounded px-2 py-1.5 text-xs w-14 outline-none focus:border-terminal-accent text-white font-mono font-bold text-center"
                  />
                </div>
                
                {/* Type */}
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">Option</label>
                  <select 
                    value={leg.type} 
                    onChange={(e) => updateLeg(leg.id, 'type', e.target.value as OptionType)}
                    className="bg-black border border-gray-700 rounded px-2.5 py-1.5 text-xs font-bold font-mono outline-none focus:border-terminal-accent text-white"
                  >
                    <option value="CALL">CALL</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>
                
                {/* Strike */}
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">Strike ($)</label>
                  <input 
                    type="number" step="0.5"
                    value={leg.strike} 
                    onChange={(e) => updateLeg(leg.id, 'strike', parseFloat(e.target.value) || 0)}
                    className="bg-black border border-gray-700 rounded px-2.5 py-1.5 text-xs w-24 outline-none focus:border-terminal-accent text-white font-mono font-bold"
                  />
                </div>
                
                {/* Monthly Expiration Picker (1 to 8 Months) */}
                <div className="flex flex-col flex-1 min-w-[170px]">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">Monthly Expiration (1-6 Mo+)</label>
                  <select
                    value={leg.dte}
                    onChange={(e) => updateLeg(leg.id, 'dte', parseInt(e.target.value) || 30)}
                    className="bg-black border border-gray-700 rounded px-2.5 py-1.5 text-xs outline-none focus:border-terminal-accent text-amber-300 font-mono font-bold"
                  >
                    {monthlyExpirations.map((exp) => (
                      <option key={exp.dateString} value={exp.dte}>
                        {exp.dateString} ({exp.dte} DTE)
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* IV */}
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-mono text-gray-500 mb-1">IV (%)</label>
                  <input 
                    type="number" step="1" min="1" max="500"
                    value={Math.round(leg.impliedVol * 100)} 
                    onChange={(e) => updateLeg(leg.id, 'impliedVol', (parseFloat(e.target.value) || 1) / 100)}
                    className="bg-black border border-gray-700 rounded px-2 py-1.5 text-xs w-16 outline-none focus:border-terminal-accent text-white font-mono text-center"
                  />
                </div>
                
                <button 
                  onClick={() => handleRemoveLeg(leg.id)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                  title="Remove Leg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            
            {legs.length === 0 && (
              <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                No active legs. Click <strong>Add Leg</strong> or select a template above.
              </div>
            )}
          </div>
        </div>

        {/* AI Insight & Actions (Col Span 1) */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <BrainCircuit size={18} className="text-terminal-accent" /> Quantitative Rationale
          </h3>

          <div className="bg-[#0b0c0e] border border-gray-800 rounded-xl p-5 space-y-4 text-xs leading-relaxed">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                (analytics.aggregate?.delta || 0) > 10 ? 'bg-green-400' : (analytics.aggregate?.delta || 0) < -10 ? 'bg-red-400' : 'bg-sky-400'
              }`} />
              <span className="font-mono font-bold text-white uppercase">
                {(analytics.aggregate?.delta || 0) > 10 ? 'Bullish Directional Bias' : (analytics.aggregate?.delta || 0) < -10 ? 'Bearish Directional Bias' : 'Delta-Neutral Strategy'}
              </span>
            </div>

            <p className="text-gray-300">
              {(analytics.aggregate?.theta || 0) > 0 ? (
                <>This structure is <strong className="text-emerald-400">Theta-Positive (+${Math.abs(analytics.aggregate?.theta || 0).toFixed(2)}/day)</strong>, capturing premium as time decays toward monthly expirations.</>
              ) : (
                <>This structure is <strong className="text-amber-400">Long Gamma / Convexity</strong>, trading daily theta decay for explosive upside payoff if {ticker} moves aggressively.</>
              )}
            </p>

            <div className="bg-black/40 p-3 rounded-lg border border-gray-800/80 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-gray-400">
                <span>Gamma Acceleration:</span>
                <span className="text-white">{(analytics.aggregate?.gamma || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Volatility Skew (Vega):</span>
                <span className="text-white">${(analytics.aggregate?.vega || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Risk-Adjusted Expectancy:</span>
                <span className="text-emerald-400">{analytics.riskRewardRatio}</span>
              </div>
            </div>
          </div>

          {/* Database & Export Card */}
          <div className="bg-[#0b0c0e] border border-gray-800 rounded-xl p-4 space-y-3">
            <button
              onClick={handleSaveToDb}
              disabled={saving || saved}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                saved 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-terminal-accent text-black hover:bg-white shadow-lg shadow-terminal-accent/10'
              }`}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <BookmarkCheck size={15} /> : <Save size={15} />}
              {saved ? "Saved to History Database" : "Save Strategy Setup"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => exportAsPDF(exportPayload)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-500/40 text-xs text-sky-300 font-bold rounded-lg transition-all"
              >
                <Download size={13} /> PDF Report
              </button>
              <button 
                onClick={() => exportAsCSV(exportPayload)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
              >
                <FileSpreadsheet size={13} className="text-green-400" /> CSV Table
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* Interactive Payoff Chart */}
      <div className="bg-gradient-to-b from-[#0c0d10] to-[#07080a] border border-gray-800 rounded-2xl p-6 h-[440px] shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              Payoff Curve & Probability Distribution
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              Solid Line: Payoff at Expiration (T=0) • Dotted Line: Payoff Today with Time Value (T=now)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-white inline-block"></span>
              <span className="text-gray-300">At Expiration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed inline-block"></span>
              <span className="text-sky-400">Payoff Today</span>
            </div>
          </div>
        </div>

        {analytics.payoffData.length > 0 ? (
          <ResponsiveContainer width="100%" height="88%">
            <LineChart data={analytics.payoffData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
              <XAxis 
                dataKey="price" 
                stroke="#666" 
                tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
                domain={['dataMin', 'dataMax']}
                type="number"
                tick={{ fontSize: 11, fill: '#888' }}
              />
              <YAxis 
                stroke="#666" 
                tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
                tick={{ fontSize: 11, fill: '#888' }}
              />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#090a0c', borderColor: '#2d3139', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: number, name: string) => [
                  `$${val.toFixed(2)}`, 
                  name === 'pnl' ? 'P/L at Expiration' : 'P/L Today'
                ]}
                labelFormatter={(val) => `Underlying Price: $${Number(val).toFixed(2)}`}
              />
              <ReferenceLine y={0} stroke="#444" strokeWidth={1} />
              
              {currentPrice && (
                <ReferenceLine 
                  x={currentPrice} 
                  stroke="#00b8ff" 
                  strokeDasharray="4 4" 
                  label={{ position: 'top', value: `Spot: $${currentPrice.toFixed(2)}`, fill: '#00b8ff', fontSize: 11 }} 
                />
              )}

              {analytics.breakevens.map((be, idx) => (
                <ReferenceLine 
                  key={idx}
                  x={be} 
                  stroke="#f59e0b" 
                  strokeDasharray="3 3" 
                  label={{ position: 'bottom', value: `BE: $${be}`, fill: '#f59e0b', fontSize: 10 }} 
                />
              ))}

              <Line 
                type="monotone" 
                dataKey="pnlToday" 
                stroke="#38bdf8" 
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="pnl" 
                stroke="#ffffff" 
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono text-xs">
            Add legs or select a strategy preset to generate payoff distribution curve.
          </div>
        )}
      </div>

    </div>
  );
};
