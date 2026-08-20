# OptiGreek Advisor — Project Context & Quantitative Research Log

> **Maintained as the authoritative working source of truth for all ongoing development.**
> Update this file after every significant change, bug fix, or research finding.

---

## 1. Purpose

OptiGreek Advisor is a full-stack browser-based quantitative finance research platform for:
- Stock and options price analysis (Greeks, IV surface, payoff curves)
- Probabilistic prediction across multiple return horizons (1–360 days)
- Strategy backtesting with rigorous out-of-sample walk-forward validation
- AI-assisted market scanning and options strategy optimization
- Historical session persistence via Firebase Firestore

---

## 2. Architecture

```
App.tsx (root — navigation state machine)
├── FirebaseProvider.tsx         Auth context (Google sign-in)
├── QuantToolsSidebar.tsx        Floating toolbox drawer
└── Mode Router:
    ├── AnalysisView.tsx          LIVE mode — Greeks, IV surface, news
    │   ├── GreeksCard.tsx        Delta/Gamma/Theta/Vega/Rho + Charm/Vanna/Volga
    │   ├── VolatilitySurfacePlot.tsx   D3 3D IV surface
    │   └── TickerNewsFeed.tsx    Gemini news sentiment classifier
    ├── PredictionEngineView.tsx  PREDICT mode — TF.js predictor + MC cone
    ├── MarketScannerView.tsx     SCANNER mode — multi-ticker ranking grid
    ├── StrategyBuilderView.tsx   STRATEGY mode — multi-leg payoff builder
    ├── BacktestView.tsx          BACKTEST mode — equity curve + trade log
    ├── QuantSandboxView.tsx      SANDBOX mode — code editor
    ├── AwesomeQuantView.tsx      AWESOME mode — quant formula library
    └── HistoryView.tsx           HISTORY mode — Firestore saved runs
```

### Key Services
| File | Responsibility |
|------|---------------|
| `services/quantEngine.ts` | **NEW (v4)** — Analytical BS pricing, Greeks, Student-t MC, HAR-RV, Sortino, Calmar, Kelly, ATR, IVP/IVR |
| `services/backtestEngine.ts` | Master quant engine: walk-forward backtests, Monte Carlo, calibration metrics, options optimizer entry |
| `services/optionsOptimizer.ts` | Options strategy candidates with BS-priced legs and analytical Greeks |
| `services/optionsChainValidator.ts` | Chain arbitrage detection, crossed-quote rejection, put-call parity |
| `services/gemini.ts` | Gemini API calls with structured JSON schemas for all modes |
| `services/expirationUtils.ts` | Standard monthly expiration (3rd Friday) computation |
| `services/exportUtils.ts` | PDF / CSV / JSON export |
| `services/firebase.ts` | Firebase init |
| `services/historyService.ts` | Firestore CRUD |

---

## 3. Quantitative Models

### 3.1 Options Pricing
- **Model**: Exact Black-Scholes-Merton (Abramowitz & Stegun normal CDF, error < 7.5e-8)
- **File**: `services/quantEngine.ts` → `calcBlackScholesPrice()`
- **Prior bug**: All strategy candidates in `optionsOptimizer.ts` used `approxAtmCall = S × 0.4 × σ × √T` (rough heuristic) and hardcoded static Greeks (delta: 0.50, gamma: 0.02, etc.)
- **Fix (v4)**: All legs now priced with exact BS formula; Greeks computed analytically per leg

### 3.2 Greeks
| Greek | Function | Notes |
|-------|----------|-------|
| Delta | `calcAnalyticalGreeks` | Analytically exact |
| Gamma | `calcAnalyticalGreeks` | Analytically exact |
| Theta | `calcAnalyticalGreeks` | Per calendar day |
| Vega | `calcAnalyticalGreeks` | Per 1% σ move |
| Rho | `calcAnalyticalGreeks` | Per 1% r move |
| Charm | `calcAnalyticalGreeks` | dΔ/dt (delta decay) — **NEW in v4** |
| Vanna | `calcAnalyticalGreeks` | dΔ/dσ = dVega/dS — **NEW in v4** |
| Volga/Vomma | `calcAnalyticalGreeks` | dVega/dσ (vol convexity) — **NEW in v4** |

### 3.3 Volatility Modeling
- **HAR-RV (Corsi 2009)**: `calcHARRV()` in `quantEngine.ts`
  - Components: RV_d (daily), RV_w (5-day avg), RV_m (22-day avg)
  - Betas: β₀=1e-6, βd=0.23, βw=0.24, βm=0.28 (empirical S&P 500)
  - Used for: daily vol forecast in Monte Carlo, IV estimation
  - **Prior**: Simple `σ_annualized = σ_daily × √252` (ignores autocorrelation structure)

- **IV Estimation** (`estimateImpliedVol()`):
  - IV = HAR-RV forecast + 3% base VRP + 0.8% per recent stress day (down >1.5%)
  - **Prior**: `IV = RV × (1.05 + recentStress/100)` — no structural VRP model

- **IV Percentile / IV Rank**: `calcIVPercentile()`, `calcIVRank()` in `quantEngine.ts`

### 3.4 Monte Carlo Simulation
- **Paths**: 10,000 deterministic (Mulberry32 PRNG seed=42)
- **Horizons**: 1, 3, 5, 10, 20, 30, 60, 90, 252, 360 days
- **Distribution**: Student-t(df=5) via ratio-of-normals — **FIXED in v4**
  - **Prior critical bug**: Code claimed Student-t but divided by `sqrt(5/(5-2))` which NARROWED the distribution (opposite of fat tails!)
  - **Fix**: `t = Z₀ / sqrt(χ²(5)/5)` where χ²(5) = Σ₁⁵ Zᵢ² — correct heavy-tail generation
  - Excess kurtosis at df=5: `6/(df-4) = 6` (vs 0 for normal)
- **Drift model**: Log-normal with Ito correction: `r_d = μ - ½σ² + σ·t_5`
- **Terminal prices for options evaluation**: Uses actual 10,000 MC paths for 30-day horizon
  - **Prior critical bug**: Used linear interpolation of p5→p95 quantiles (missed tails, wrong distribution)

### 3.5 Calibration Metrics
- Brier Score (BS), Brier Skill Score (BSS = 1 - BS/BS_baseline)
- Log-loss, ECE (Expected Calibration Error)
- Directional accuracy vs. random walk baseline
- Autocorrelation-adjusted effective sample size (Newey-West style)
- Wilson Score 95% CI on win rates

### 3.6 Backtesting
- **Method**: Purged expanding walk-forward with 5-bar embargo
- **Strategies**: EMA crossover (20/50), RSI (38/62), Bollinger Mean Reversion, MACD histogram
- **Prior bug (Bollinger)**: Buy signal was `close > upper_band` (breakout) — strategy named "mean reversion" but logic was inverted
  - **Fix**: `buy when close < lower_band`, `sell when close ≥ middle_band` (proper mean reversion)
- **Prior bug (MACD strength)**: `signalStrength = abs(hist) * 50` overflowed for large-cap stocks
  - **Fix**: ATR-normalized: `signalStrength = min(100, abs(hist)/ATR * 25)`
- **New metrics (v4)**: Sortino ratio (`calcSortinoRatio`), Calmar ratio (`calcCalmarRatio`), per-strategy MaxDrawdown (`calcMaxDrawdownSequence`)
- Equity curve tracked per-strategy for accurate max drawdown

---

## 4. Data Sources
- **Price data**: Gemini AI with Google Search grounding (fetches real-time prices)
- **Historical candles**: Gemini AI-generated or deterministic synthetic series (5-year, PRNG seeded by ticker hash) when real data unavailable
- **News**: Gemini AI with Google Search grounding (`fetchTickerNewsAndSentiment`)
- **IV**: Estimated from HAR-RV + dynamic VRP model (not market-sourced)
- **Options chain**: Synthetic chain built from BS prices + spread model

---

## 5. Key Design Decisions

### Why Client-Side Only?
- No server-side API proxy; all computation in browser via TF.js WebGL
- Firebase for persistence; Gemini API key from `process.env.API_KEY`

### Why Student-t(df=5)?
- Empirical equity return kurtosis ≈ 4–8 (excess kurtosis 2–6)
- df=5 gives excess kurtosis = 6/(df-4) = 6 — well within empirical range
- df=5 is the standard recommendation for equity option risk (Merton 1976 extension)

### Why HAR-RV over GARCH?
- HAR-RV requires no iterative optimization (GARCH requires MLE)
- Captures long-memory in volatility via multi-scale components
- Out-of-sample performance equal or superior to GARCH(1,1) on daily equity returns (Andersen et al.)
- Runs in O(n) vs GARCH O(n²)

### Why Exact BS vs Approximation?
- ATM approximation had 2–5% pricing error for OTM strikes
- Hardcoded Greeks (delta=0.50) caused completely wrong strategy Greeks display
- Exact BS adds negligible computation cost (no iterative solve needed for price)

---

## 6. Improvements Made (v4 — August 2026)

### Critical Bug Fixes
| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `backtestEngine.ts` | Student-t generation divided by `sqrt(5/3)` — NARROWED distribution | Proper ratio-of-normals: `t = Z₀/√(χ²(5)/5)` |
| 2 | `optionsOptimizer.ts` | Hardcoded static Greeks (delta=0.50 for all strategies) | Analytical BS Greeks per leg via `calcAnalyticalGreeks` |
| 3 | `optionsOptimizer.ts` | ATM premium used rough `0.4·σ·√T` heuristic | Exact `calcBlackScholesPrice(S, K, T, r, σ)` |
| 4 | `backtestEngine.ts` | Terminal price distribution used linear p5→p95 interpolation | Real MC terminal prices from 30-day simulation paths |
| 5 | `backtestEngine.ts` | Bollinger "Mean Reversion": bought when `close > upper` (breakout) | Fixed to `close < lower` buy, `close ≥ middle` sell |
| 6 | `backtestEngine.ts` | MACD signal strength `abs(hist)*50` always maxes at 100 for large-caps | ATR-normalized: `abs(hist)/ATR * 25` |
| 7 | `optionsChainValidator.ts` | ATM approximation for synthetic chain quotes | Exact BS pricing for all chain strikes |

### New Capabilities
| # | Feature | Location |
|---|---------|----------|
| 1 | `calcBlackScholesPrice` — Exact BS with A&S normal CDF | `quantEngine.ts` |
| 2 | `calcAnalyticalGreeks` — All 8 Greeks including Charm/Vanna/Volga | `quantEngine.ts` |
| 3 | `solveImpliedVolatility` — Newton-Raphson IV solver | `quantEngine.ts` |
| 4 | `studentTVariate` — Correct Student-t(df) random variate | `quantEngine.ts` |
| 5 | `calcHARRV` — Heterogeneous AutoRegressive Realized Variance | `quantEngine.ts` |
| 6 | `calcSortinoRatio`, `calcCalmarRatio`, `calcCAGR` | `quantEngine.ts` |
| 7 | `calcMaxDrawdownSequence` — Full peak/trough/recovery tracking | `quantEngine.ts` |
| 8 | `calcKellyCriterion` — Full/half/quarter Kelly position sizing | `quantEngine.ts` |
| 9 | `calcIVPercentile`, `calcIVRank` — IVP/IVR utilities | `quantEngine.ts` |
| 10 | `calcATR` — Wilder's ATR (used for MACD normalization) | `quantEngine.ts` |
| 11 | `calcRollingRealizedVol`, `calcPriceZScore`, `calcBBPercentB` | `quantEngine.ts` |
| 12 | `calcExpectedMove`, `calcProbabilityITM` — Probability analytics | `quantEngine.ts` |
| 13 | `estimateImpliedVol` — HAR-RV + dynamic VRP estimator | `quantEngine.ts` |
| 14 | Sortino + Calmar + MaxDD fields on `StrategyBacktestResult` | `backtestEngine.ts` |
| 15 | Charm/Vanna/Volga displayed in `GreeksCard` | `GreeksCard.tsx` |
| 16 | Greeks interface extended with optional Charm/Vanna/Volga | `types.ts` |

---

## 7. Known Issues & Remaining Weaknesses

### High Priority
- **IV is estimated, not market-sourced**: All IV values are model-derived (HAR-RV + VRP). A real brokerage API (IBKR, Tradier, TD Ameritrade) would provide actual market IV. This affects all options pricing accuracy.
- **No real historical candle data**: Synthetic candles from deterministic PRNG when real data unavailable. Results are statistically sound but not factually accurate for a specific ticker.
- **TF.js predictor uses a dense network**: `PredictionEngineView.tsx` uses a Sequential dense model. This should be an LSTM/TCN for time series. The current model likely overfits.
- **Single-regime Monte Carlo**: Drift and vol are constant over simulation paths. A regime-switching model (HMM or Markov-switching GARCH) would be more realistic.

### Medium Priority
- **No realized IV skew model**: The IV surface uses a parametric skew formula. No calibration to actual options market quotes.
- **No transaction costs in options backtest**: The walk-forward backtest simulates equity entries/exits without bid-ask spread, commissions, or slippage.
- **Bollinger backtest uses price-level entries**: Should use %B or z-score with position sizing rather than binary in/out.
- **Strategy candidates use same IV for all strikes**: Real vol surface has a skew — OTM puts should have higher IV than ATM.

### Low Priority
- **No continuous time delta hedging**: Greeks are snapshot values. PnL simulation ignores gamma P&L from continuous hedging.
- **Expected payoff uses arithmetic mean**: Should use geometric mean for multi-period strategies.
- **No portfolio-level Greeks**: Strategy builder computes per-strategy Greeks but no cross-strategy correlation or portfolio-level risk.

---

## 8. Future Research Ideas

1. **EGARCH / GJR-GARCH**: Asymmetric volatility (leverage effect) — volatility rises more on down days
2. **Realized Skewness / Kurtosis features**: Add to scanner scoring for tail-risk premium strategies
3. **Cointegration screening**: For pairs trading scanner (Engle-Granger test)
4. **Ornstein-Uhlenbeck mean reversion**: For mean-reversion timing on individual stocks
5. **Random Forest for regime detection**: Use VIX, ADX, spread, IV surface slope as features
6. **Conformal prediction intervals**: Distribution-free prediction intervals for the ML predictor
7. **Walk-forward portfolio optimization**: Markowitz/Black-Litterman with rolling covariance matrix
8. **Volatility risk premium harvesting**: Systematic sell-IV strategy with delta-hedging
9. **Options market microstructure**: Put-call ratio, unusual OI, skew changes as signals
10. **Factor exposure**: Fama-French 3-factor (market, size, value) beta computation

---

## 9. Deployment & Build

```powershell
# Install dependencies
npm install --ignore-scripts

# Development
npm run dev

# Production build
npm run build
```

**Environment variables required:**
- `VITE_FIREBASE_*` — Firebase project config
- `API_KEY` — Google Gemini API key (used in `services/gemini.ts`)

---

*Last updated: 2026-08-19 by automated quantitative research agent.*
