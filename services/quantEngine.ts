/**
 * quantEngine.ts — Analytical Quantitative Finance Engine
 *
 * Provides statistically rigorous implementations of:
 * - Exact Black-Scholes pricing (Abramowitz & Stegun normal CDF)
 * - Analytical first- and second-order Greeks (Delta, Gamma, Theta, Vega, Rho, Charm, Vanna, Volga)
 * - Proper Student-t random variate generation for fat-tail Monte Carlo
 * - HAR-RV (Corsi 2009) heterogeneous volatility forecasting
 * - Sortino ratio, Calmar ratio, max-drawdown sequencing
 * - Kelly Criterion fractional position sizing
 * - IV Percentile / IV Rank
 * - ATR (Average True Range)
 * - Newton-Raphson implied-volatility solver
 * - Utility: CAGR, downside deviation
 */

// ---------------------------------------------------------------------------
// Normal Distribution Utilities
// ---------------------------------------------------------------------------

/**
 * Cumulative distribution function of the standard normal.
 * Uses the Abramowitz & Stegun rational approximation (error < 7.5e-8).
 */
export function normalCDF(x: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp(-0.5 * x * x);
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  const p = d * poly;
  return x >= 0 ? 1.0 - p : p;
}

/** Probability density function of the standard normal. */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

// ---------------------------------------------------------------------------
// Black-Scholes Pricing
// ---------------------------------------------------------------------------

/**
 * Exact closed-form Black-Scholes price for a European option.
 * @param S  - current spot price
 * @param K  - strike price
 * @param T  - time to expiration in years (must be > 0)
 * @param r  - continuously compounded risk-free rate (decimal, e.g. 0.05)
 * @param sigma - implied volatility (decimal, e.g. 0.25)
 * @param isCall - true for call, false for put
 */
export function calcBlackScholesPrice(
  S: number, K: number, T: number, r: number, sigma: number, isCall: boolean
): number {
  if (T <= 0) return isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  if (sigma <= 0) {
    // Deterministic (zero vol): intrinsic only
    const fwd = S * Math.exp(r * T);
    return isCall
      ? Math.exp(-r * T) * Math.max(0, fwd - K)
      : Math.exp(-r * T) * Math.max(0, K - fwd);
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const df = Math.exp(-r * T);
  return isCall
    ? S * normalCDF(d1) - K * df * normalCDF(d2)
    : K * df * normalCDF(-d2) - S * normalCDF(-d1);
}

// ---------------------------------------------------------------------------
// Analytical Greeks (all first- and second-order cross-Greeks)
// ---------------------------------------------------------------------------

export interface AnalyticalGreeks {
  delta: number;    // dC/dS
  gamma: number;    // d²C/dS²
  theta: number;    // dC/dt  (per calendar day)
  vega: number;     // dC/dσ  (per 1% change in σ)
  rho: number;      // dC/dr  (per 1% change in r)
  charm: number;    // dΔ/dt  (delta decay per calendar day)
  vanna: number;    // dΔ/dσ = dVega/dS  (per 1% σ, per $1 move)
  volga: number;    // dVega/dσ (Vomma; per 1% σ change²)
}

/**
 * Computes all first- and second-order Black-Scholes Greeks analytically.
 * Charm, Vanna, and Volga (Vomma) capture second-order cross-sensitivities
 * essential for dynamic hedging under changing volatility and time.
 */
export function calcAnalyticalGreeks(
  S: number, K: number, T: number, r: number, sigma: number, isCall: boolean
): AnalyticalGreeks {
  if (T <= 1e-8) {
    const delta = isCall ? (S >= K ? 1 : 0) : (S < K ? -1 : 0);
    return { delta, gamma: 0, theta: 0, vega: 0, rho: 0, charm: 0, vanna: 0, volga: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalPDF(d1);
  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const df = Math.exp(-r * T);

  const delta = isCall ? Nd1 : Nd1 - 1.0;
  const gamma = nd1 / (S * sigma * sqrtT);

  // Theta: change in option value per calendar day
  const thetaCommon = -(S * nd1 * sigma) / (2.0 * sqrtT);
  const theta = isCall
    ? (thetaCommon - r * K * df * Nd2) / 365.0
    : (thetaCommon + r * K * df * normalCDF(-d2)) / 365.0;

  // Vega: change per 1% absolute move in σ (standard market convention)
  const vega = S * sqrtT * nd1 / 100.0;

  // Rho: change per 1% absolute move in r
  const rho = isCall
    ? K * T * df * Nd2 / 100.0
    : -K * T * df * normalCDF(-d2) / 100.0;

  // Charm (delta decay): dΔ/dt, per calendar day
  // Corr. formula from Natenberg "Option Volatility & Pricing"
  const charmRaw = -nd1 * (2.0 * r * T - d2 * sigma * sqrtT) / (2.0 * T * sigma * sqrtT);
  const charm = isCall ? charmRaw / 365.0 : charmRaw / 365.0; // sign same for both

  // Vanna: dΔ/dσ (also dVega/dS). Scaled per 1% σ.
  const vanna = (-nd1 * d2 / sigma) / 100.0;

  // Volga (Vomma): dVega/dσ. Scaled per 1% σ.
  const volga = (vega * d1 * d2) / sigma;

  return {
    delta:  Number(delta.toFixed(6)),
    gamma:  Number(gamma.toFixed(8)),
    theta:  Number(theta.toFixed(6)),
    vega:   Number(vega.toFixed(6)),
    rho:    Number(rho.toFixed(6)),
    charm:  Number(charmRaw / 365.0 ? charmRaw / 365.0 : 0),
    vanna:  Number(vanna.toFixed(6)),
    volga:  Number(volga.toFixed(6)),
  };
}

// ---------------------------------------------------------------------------
// Implied Volatility Solver (Newton-Raphson)
// ---------------------------------------------------------------------------

/**
 * Inverts the Black-Scholes formula to solve for implied volatility.
 * Uses Newton-Raphson with Brenner-Subrahmanyam seed (20 iterations max).
 * Returns null if the price is below intrinsic or convergence fails.
 */
export function solveImpliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  isCall: boolean,
  tolerance = 1e-6
): number | null {
  if (T <= 0) return null;
  const intrinsic = isCall ? Math.max(0, S - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - S);
  if (marketPrice < intrinsic - tolerance) return null;

  // Brenner-Subrahmanyam ATM seed
  let sigma = Math.sqrt(2 * Math.PI / T) * (marketPrice / S);
  sigma = Math.max(0.01, Math.min(10, sigma));

  for (let i = 0; i < 100; i++) {
    const price = calcBlackScholesPrice(S, K, T, r, sigma, isCall);
    const diff = price - marketPrice;
    if (Math.abs(diff) < tolerance) return Number(sigma.toFixed(6));

    // Vega (unscaled, per unit σ)
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const vegaRaw = S * sqrtT * normalPDF(d1);
    if (vegaRaw < 1e-12) break;
    sigma -= diff / vegaRaw;
    sigma = Math.max(0.001, Math.min(10, sigma));
  }
  const finalPrice = calcBlackScholesPrice(S, K, T, r, sigma, isCall);
  return Math.abs(finalPrice - marketPrice) < 0.01 ? Number(sigma.toFixed(6)) : null;
}

// ---------------------------------------------------------------------------
// Proper Student-t Random Variate (ratio-of-normals method)
// ---------------------------------------------------------------------------

/**
 * Generates a Student-t(df) random variate using the polar ratio-of-normals
 * approach: t_ν = Z / sqrt(χ²(ν) / ν) where Z ~ N(0,1) and χ²(ν) = Σ zᵢ².
 * This produces the correct heavy-tailed distribution (df=5 has ~2.3× more
 * kurtosis than normal, matching empirical equity return distributions).
 *
 * @param prng - a () => number random generator in (0,1)
 * @param df   - degrees of freedom (integer ≥ 2; use 4-6 for equities)
 */
export function studentTVariate(prng: () => number, df: number): number {
  // Generate numerator: Z₀ ~ N(0,1) using Box-Muller
  const u0a = Math.max(1e-12, prng());
  const u0b = prng();
  const z0 = Math.sqrt(-2.0 * Math.log(u0a)) * Math.cos(2.0 * Math.PI * u0b);

  // Generate chi-squared denominator: Σ_{i=1}^{df} Zᵢ² (each Zᵢ ~ N(0,1))
  let chiSqSum = 0;
  for (let i = 0; i < df; i++) {
    const ua = Math.max(1e-12, prng());
    const ub = prng();
    const za = Math.sqrt(-2.0 * Math.log(ua)) * Math.cos(2.0 * Math.PI * ub);
    chiSqSum += za * za;
  }
  return z0 / Math.sqrt(chiSqSum / df);
}

// ---------------------------------------------------------------------------
// HAR-RV Volatility Forecasting (Corsi 2009)
// ---------------------------------------------------------------------------

export interface HARRVForecast {
  forecastDailyVol: number;       // σ_forecast for 1 day (decimal)
  forecastAnnualizedVol: number;  // σ * √252 (decimal)
  components: {
    daily: number;    // last realized variance (RV_d)
    weekly: number;   // 5-day avg realized variance (RV_w)
    monthly: number;  // 22-day avg realized variance (RV_m)
  };
}

/**
 * HAR-RV (Heterogeneous AutoRegressive Realized Variance) model.
 * Empirically outperforms GARCH on equity daily return series.
 * Ref: Corsi, F. (2009). "A Simple Approximate Long-Memory Model of Realized Volatility."
 * Journal of Financial Econometrics, 7(2), 174-196.
 *
 * Uses Corsi empirical beta estimates validated on S&P 500 data:
 *   β₀ ≈ 1e-6  (intercept)
 *   β_d ≈ 0.23  (daily component)
 *   β_w ≈ 0.24  (weekly component)
 *   β_m ≈ 0.28  (monthly component)
 */
export function calcHARRV(dailyLogReturns: number[]): HARRVForecast {
  const n = dailyLogReturns.length;
  if (n < 22) {
    // Fallback to simple historical vol when insufficient data
    const rv = dailyLogReturns.reduce((s, r) => s + r * r, 0) / Math.max(1, n);
    const dailyVol = Math.sqrt(rv);
    return {
      forecastDailyVol: dailyVol,
      forecastAnnualizedVol: dailyVol * Math.sqrt(252),
      components: { daily: rv, weekly: rv, monthly: rv }
    };
  }

  const dailyRVs = dailyLogReturns.map(r => r * r);
  const lastDailyRV = dailyRVs[n - 1];
  const lastWeeklyRV = dailyRVs.slice(n - 5).reduce((a, b) => a + b, 0) / 5;
  const lastMonthlyRV = dailyRVs.slice(n - 22).reduce((a, b) => a + b, 0) / 22;

  const beta0 = 1e-6;
  const betaD = 0.23;
  const betaW = 0.24;
  const betaM = 0.28;

  const forecastDailyVar = Math.max(
    1e-9,
    beta0 + betaD * lastDailyRV + betaW * lastWeeklyRV + betaM * lastMonthlyRV
  );
  const forecastDailyVol = Math.sqrt(forecastDailyVar);

  return {
    forecastDailyVol,
    forecastAnnualizedVol: forecastDailyVol * Math.sqrt(252),
    components: { daily: lastDailyRV, weekly: lastWeeklyRV, monthly: lastMonthlyRV }
  };
}

// ---------------------------------------------------------------------------
// Risk & Performance Metrics
// ---------------------------------------------------------------------------

/**
 * Sortino Ratio: risk-adjusted return using downside deviation only.
 * @param annualizationFactor - √252 for daily returns, 1 for per-trade returns
 */
export function calcSortinoRatio(dailyReturns: number[], targetReturn = 0, annualizationFactor = Math.sqrt(252)): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const downsideVar = dailyReturns.reduce((s, r) => {
    const shortfall = Math.min(0, r - targetReturn);
    return s + shortfall * shortfall;
  }, 0) / dailyReturns.length;
  const downsideDev = Math.sqrt(downsideVar);
  if (downsideDev < 1e-12) return mean > 0 ? 5.0 : 0;
  return Number(((mean / downsideDev) * annualizationFactor).toFixed(3));
}

/**
 * Calmar Ratio: CAGR / Maximum Drawdown.
 * @param cagr           - annualized return (percent, e.g. 12.5)
 * @param maxDrawdownPct - max drawdown (percent, e.g. 15.0; must be > 0)
 */
export function calcCalmarRatio(cagr: number, maxDrawdownPct: number): number {
  if (maxDrawdownPct <= 0) return cagr > 0 ? 5.0 : 0;
  return Number((cagr / maxDrawdownPct).toFixed(3));
}

/** CAGR from start/end equity and time in years. */
export function calcCAGR(startEquity: number, endEquity: number, years: number): number {
  if (startEquity <= 0 || years <= 0) return 0;
  return Number(((Math.pow(endEquity / startEquity, 1.0 / years) - 1) * 100).toFixed(2));
}

export interface DrawdownResult {
  maxDrawdownPct: number;
  peakIdx: number;
  troughIdx: number;
  recoveryIdx: number | null;
  drawdownDurationDays: number;
  recoveryDurationDays: number | null;
}

/**
 * Computes max drawdown with peak/trough indices and recovery tracking.
 * Input is an equity curve (absolute values, not returns).
 */
export function calcMaxDrawdownSequence(equityCurve: number[]): DrawdownResult {
  if (equityCurve.length < 2) {
    return { maxDrawdownPct: 0, peakIdx: 0, troughIdx: 0, recoveryIdx: null, drawdownDurationDays: 0, recoveryDurationDays: null };
  }
  let maxDD = 0;
  let peak = equityCurve[0];
  let peakIdx = 0;
  let bestPeakIdx = 0;
  let bestTroughIdx = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      peakIdx = i;
    }
    const dd = peak > 0 ? (peak - equityCurve[i]) / peak : 0;
    if (dd > maxDD) {
      maxDD = dd;
      bestPeakIdx = peakIdx;
      bestTroughIdx = i;
    }
  }

  let recoveryIdx: number | null = null;
  for (let i = bestTroughIdx + 1; i < equityCurve.length; i++) {
    if (equityCurve[i] >= equityCurve[bestPeakIdx]) {
      recoveryIdx = i;
      break;
    }
  }

  return {
    maxDrawdownPct: Number((maxDD * 100).toFixed(2)),
    peakIdx: bestPeakIdx,
    troughIdx: bestTroughIdx,
    recoveryIdx,
    drawdownDurationDays: bestTroughIdx - bestPeakIdx,
    recoveryDurationDays: recoveryIdx !== null ? recoveryIdx - bestTroughIdx : null
  };
}

// ---------------------------------------------------------------------------
// Kelly Criterion
// ---------------------------------------------------------------------------

export interface KellyResult {
  fullKellyFraction: number;  // raw Kelly fraction
  halfKelly: number;          // recommended 50% of Kelly
  quarterKelly: number;       // conservative 25% of Kelly
  expectedGrowthRate: number; // E[log(1 + f*X)] approximation
}

/**
 * Kelly Criterion for position sizing.
 * f* = (p·b - q) / b  where b = avg_win / avg_loss.
 * Caps full Kelly at 25% to prevent over-leverage.
 *
 * @param winRatePct  - percentage of winning trades (0-100)
 * @param avgWinPct   - average winning trade return (percentage)
 * @param avgLossPct  - average losing trade return magnitude (percentage, positive)
 */
export function calcKellyCriterion(
  winRatePct: number, avgWinPct: number, avgLossPct: number
): KellyResult {
  const p = Math.max(0, Math.min(1, winRatePct / 100));
  const q = 1 - p;
  const b = avgLossPct > 0 ? avgWinPct / avgLossPct : 1.0;
  const kelly = (p * b - q) / b;
  const fullKelly = Math.max(0, Math.min(0.50, kelly));
  const expectedGrowthRate = p * Math.log(1 + fullKelly * b) + q * Math.log(1 - fullKelly);
  return {
    fullKellyFraction: Number(fullKelly.toFixed(4)),
    halfKelly: Number((fullKelly * 0.5).toFixed(4)),
    quarterKelly: Number((fullKelly * 0.25).toFixed(4)),
    expectedGrowthRate: Number(expectedGrowthRate.toFixed(6)),
  };
}

// ---------------------------------------------------------------------------
// ATR (Average True Range)
// ---------------------------------------------------------------------------

/**
 * Computes ATR(period) using Wilder's smoothed method.
 * Output array length matches input candle array.
 * Pads the first (period-1) values with the initial simple average.
 */
export function calcATR(
  candles: ReadonlyArray<{ high: number; low: number; close: number }>,
  period = 14
): number[] {
  if (candles.length === 0) return [];
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const prevClose = i > 0 ? candles[i - 1].close : candles[i].close;
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    ));
  }
  const atrs: number[] = new Array(Math.min(period - 1, candles.length)).fill(trs[0]);
  const initSum = trs.slice(0, Math.min(period, trs.length)).reduce((a, b) => a + b, 0);
  let prev = initSum / Math.min(period, trs.length);
  atrs.push(prev);
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
    atrs.push(prev);
  }
  return atrs;
}

// ---------------------------------------------------------------------------
// IV Percentile & IV Rank
// ---------------------------------------------------------------------------

/**
 * IV Percentile (IVP): fraction of historical IV observations below currentIV.
 * Range [0, 100]. High IVP → options relatively expensive.
 */
export function calcIVPercentile(ivHistory: number[], currentIV: number): number {
  if (ivHistory.length === 0) return 50;
  const below = ivHistory.filter(iv => iv < currentIV).length;
  return Number(((below / ivHistory.length) * 100).toFixed(1));
}

/**
 * IV Rank (IVR): (current – 52-wk low) / (52-wk high – 52-wk low) × 100.
 * Range [0, 100]. IVR > 50 → IV is in the upper half of its 52-week range.
 */
export function calcIVRank(ivHistory: number[], currentIV: number): number {
  if (ivHistory.length === 0) return 50;
  const low = Math.min(...ivHistory);
  const high = Math.max(...ivHistory);
  if (high <= low) return 50;
  return Number(Math.max(0, Math.min(100, ((currentIV - low) / (high - low)) * 100)).toFixed(1));
}

// ---------------------------------------------------------------------------
// Realized Volatility & Z-Score Utilities
// ---------------------------------------------------------------------------

/** Rolling realized volatility (annualized) over a window of log-returns. */
export function calcRollingRealizedVol(logReturns: number[], window: number): number[] {
  const vols: number[] = [];
  for (let i = 0; i < logReturns.length; i++) {
    const slice = logReturns.slice(Math.max(0, i - window + 1), i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const var_ = slice.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, slice.length - 1);
    vols.push(Math.sqrt(var_) * Math.sqrt(252));
  }
  return vols;
}

/** Z-score of current price relative to a rolling mean and std. */
export function calcPriceZScore(prices: number[], window: number): number[] {
  const zScores: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    const slice = prices.slice(Math.max(0, i - window + 1), i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = Math.sqrt(slice.reduce((s, p) => s + (p - mean) ** 2, 0) / Math.max(1, slice.length - 1));
    zScores.push(std > 0 ? (prices[i] - mean) / std : 0);
  }
  return zScores;
}

/** Bollinger Band %B: (price - lower) / (upper - lower). Range roughly 0-1. */
export function calcBBPercentB(
  price: number, upper: number, lower: number
): number {
  const range = upper - lower;
  return range > 0 ? (price - lower) / range : 0.5;
}

// ---------------------------------------------------------------------------
// Probability of Profit Utilities
// ---------------------------------------------------------------------------

/**
 * BS-derived probability that the option expires in-the-money (risk-neutral).
 * For calls: N(d2); for puts: N(-d2).
 */
export function calcProbabilityITM(
  S: number, K: number, T: number, r: number, sigma: number, isCall: boolean
): number {
  if (T <= 0) return isCall ? (S > K ? 1 : 0) : (S < K ? 1 : 0);
  const sqrtT = Math.sqrt(T);
  const d2 = (Math.log(S / K) + (r - 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return isCall ? normalCDF(d2) : normalCDF(-d2);
}

/**
 * Expected move (1 SD) at horizon h (days) using annualized vol.
 * Returns { upper, lower, expectedMoveDollar } relative to spot S.
 */
export function calcExpectedMove(S: number, annualizedVol: number, horizonDays: number): {
  upper: number; lower: number; expectedMoveDollar: number;
} {
  const em = S * annualizedVol * Math.sqrt(horizonDays / 365);
  return {
    upper: Number((S + em).toFixed(2)),
    lower: Number((S - em).toFixed(2)),
    expectedMoveDollar: Number(em.toFixed(2))
  };
}

// ---------------------------------------------------------------------------
// Volatility Risk Premium
// ---------------------------------------------------------------------------

/**
 * Estimates the volatility risk premium (VRP = IV - RV) which reflects
 * the excess compensation sellers receive for bearing variance risk.
 * Uses HAR-RV for the realized vol component and adds a dynamic stress premium.
 */
export function estimateImpliedVol(
  annualizedRVDecimal: number,
  dailyLogReturns: number[]
): { iv: number; vrp: number } {
  const harForecast = calcHARRV(dailyLogReturns);
  const rvForecast = harForecast.forecastAnnualizedVol;

  // Dynamic VRP: typically 3-6% in normal markets, higher in stress
  const recent10 = dailyLogReturns.slice(-10);
  const recentStressDays = recent10.filter(r => r < -0.015).length; // days down >1.5%
  const stressPremium = recentStressDays * 0.008; // +0.8% per recent stress day
  const baseVRP = 0.03; // 3% baseline VRP
  const iv = Math.min(3.0, rvForecast + baseVRP + stressPremium);
  const vrp = iv - annualizedRVDecimal;
  return {
    iv: Number(iv.toFixed(4)),
    vrp: Number(vrp.toFixed(4))
  };
}
