# OptiGreek Advisor ⚡📈
### Institutional-Grade Quantitative Options Intelligence, AI-Powered Greeks Analysis & Volatility Modeling

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![D3.js](https://img.shields.io/badge/D3.js-7.9-F9A03C?style=flat-square&logo=d3.js)](https://d3js.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-FF6F00?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gen%20AI-Gemini%202.5%20Pro%2FFlash-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

**OptiGreek Advisor** is an end-to-end quantitative options trading platform and decision-support workstation. It combines real-time market data feeds, mathematical options pricing engines (Black-Scholes-Merton, Greeks calculus, SVI volatility surface models), Gemini 2.5 generative quantitative reasoning, TensorFlow.js client-side neural forecasting, and historical Monte Carlo backtesting.

---

## 📑 Table of Contents

- [Core Capabilities](#-core-capabilities)
- [System Architecture](#-system-architecture)
- [Module Breakdown](#-module-breakdown)
  - [1. Live Options Advisor (`LIVE`)](#1-live-options-advisor)
  - [2. Interactive D3 Volatility Surface & Smile Engine](#2-interactive-d3-volatility-surface--smile-engine)
  - [3. Multi-Leg Strategy Builder (`STRATEGY`)](#3-multi-leg-strategy-builder)
  - [4. Historical Trade Backtesting (`BACKTEST`)](#4-historical-trade-backtesting)
  - [5. Neural Price & IV Predictor (`PREDICT`)](#5-neural-price--iv-predictor)
  - [6. Real-Time Market Scanner (`SCANNER`)](#6-real-time-market-scanner)
  - [7. Interactive Quant Sandbox (`SANDBOX`)](#7-interactive-quant-sandbox)
  - [8. Awesome Quant Library (`AWESOME`)](#8-awesome-quant-library)
  - [9. Cloud History & Multi-Format Reporting (`HISTORY`)](#9-cloud-history--multi-format-reporting)
- [Quantitative & Mathematical Formulations](#-quantitative--mathematical-formulations)
- [Technology Stack](#-technology-stack)
- [Installation & Getting Started](#-installation--getting-started)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Project Directory Structure](#-project-directory-structure)
- [Export Capabilities & Reporting](#-export-capabilities--reporting)
- [Security & Firestore Rules](#-security--firestore-rules)
- [Disclaimer](#-disclaimer)

---

## ⚡ Core Capabilities

1. **Analytical Options Screener & Optimizer**: Analyzes equity underlying price action, implied volatility (IV) percentiles, and market sentiment to recommend mathematically structured strategies (Single Leg, Vertical Spreads, Iron Condors, Straddles, Calendars, Butterflies).
2. **First & Second Order Greeks Calculus**: Computes and interprets Delta ($\Delta$), Gamma ($\Gamma$), Theta ($\Theta$), Vega ($\mathcal{V}$), and Rho ($\rho$) with risk-adjusted scenario simulations.
3. **Interactive 3D D3 Volatility Surface**: Interactive parametric surface mesh modeling $\sigma(K, T)$ with yaw/pitch camera rotation, put skew adjustments, term structure contango/backwardation transitions, and cross-sectional 2D volatility smile slices.
4. **Interactive Multi-Leg Strategy Builder**: Custom options legs configuration with dynamic real-time payoff curve rendering, breakeven thresholds, Max Profit / Max Loss calculation, and Black-Scholes pricing.
5. **Historical Simulation & Backtesting Engine**: Multi-horizon historical backtests with win rate tracking, Sharpe ratio, Sortino ratio, max drawdown, and simulated equity growth curves.
6. **TensorFlow.js Neural Forecasting**: In-browser machine learning running multi-layer neural networks for price trend prediction, confidence bands, and volatility forecasting.
7. **Real-Time Market Scanner**: Multi-ticker screener evaluating high-volume tickers, IV rank, put/call volume ratios, catalyst detection, and technical setups.
8. **In-Browser Python & JavaScript Quant Sandbox**: Live code execution sandbox with pre-built quant templates (Monte Carlo simulation, Black-Scholes pricing, GARCH volatility, binomial tree models).
9. **Curated Awesome Quant Reference**: Curated quantitative finance directory containing mathematical formulas, algorithms, Python libraries, books, and trading papers.
10. **Cloud Sync & Multi-Format Document Export**: Cloud persistence via Firebase Firestore with export options to PDF, CSV, formatted text reports, and JSON.

---

## 🏛 System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPTIGREEK ADVISOR UI                                │
│                                                                                        │
│  [ LIVE ADVISOR ]  [ STRATEGY BUILDER ]  [ BACKTEST ]  [ PREDICTOR ]  [ SCANNER ]      │
│  [ QUANT SANDBOX ] [ AWESOME QUANT ]     [ VOL SURFACE ] [ HISTORY ]                   │
└───────────────────┬────────────────────────────────────────────┬───────────────────────┘
                    │                                            │
                    ▼                                            ▼
┌──────────────────────────────────────┐     ┌───────────────────────────────────────────┐
│     QUANTITATIVE ENGINE LAYER        │     │            AI & INFERENCE LAYER           │
│                                      │     │                                           │
│ • optionsOptimizer.ts (BSM, Greeks)  │     │ • Gemini 2.5 (Market Reasoning, Context)  │
│ • backtestEngine.ts (Monte Carlo)    │     │ • TensorFlow.js (In-Browser Neural Nets)  │
│ • expirationUtils.ts (Calendar / DTE)│     │ • Ticker News Feed & Sentiment Engine     │
│ • D3.js 3D Volatility Surface Engine │     │ • Options Chain Validator & Sanitizer     │
└───────────────────┬──────────────────┘     └───────────────────┬───────────────────────┘
                    │                                            │
                    ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DATA & PERSISTENCE LAYER                                 │
│                                                                                        │
│ • Yahoo Finance Market Proxy (`/api/yahoo/*`)                                          │
│ • Firebase Authentication (Google Auth & Anonymous)                                    │
│ • Firebase Firestore (`analyses` & `history` collections)                              │
│ • Multi-Format Exporter (jsPDF, jsPDF-AutoTable, CSV, JSON)                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Module Breakdown

### 1. Live Options Advisor
- **Ticker Sentiment & Market Regime**: Analyzes implied volatility rank, historical volatility, and technical momentum.
- **Recommended Option Legs**: Strike selection, expiration DTE horizon, contract type (`CALL` or `PUT`), strategy archetype, and limit entry price.
- **Visual Confidence Score Card**: Proprietary multi-factor scoring breaking down Trend Strength, Volatility Edge, Greeks Favorability, and Risk/Reward ratio.
- **Market News & Sentiment Radar**: Real-time news aggregation with categorized sentiment signals (Bullish, Neutral, Bearish).

### 2. Interactive D3 Volatility Surface & Smile Engine
- **3D Isometric/Perspective Surface Plot**: D3-powered 3D surface mesh with depth-sorted facets and customizable color scales (`Neon Terminal`, `Viridis`, `Plasma`, `RdYlBu`).
- **3D Camera Control**: 360° horizontal Yaw rotation, vertical Pitch tilt, zoom factor, and automated rotation.
- **2D Volatility Smile Slices**: Cross-sectional multi-term curves $\sigma(K)$ comparing near-term vs. LEAPS skew.
- **Matrix Heatmap & Contour Grid**: Strike vs. Expiration matrix with cell-level moneyness and delta inspector.
- **Quantitative Sliders**: Real-time adjustments for Base ATM IV ($\sigma_0$), Put Skew Steepness, and Term Structure Slope (Contango / Backwardation).

### 3. Multi-Leg Strategy Builder
- **Custom Multi-Leg Composition**: Long/Short Calls & Puts with configurable strikes, contracts, premiums, and expirations.
- **Dynamic Payoff Diagram**: Real-time SVG chart showing expiration P&L, current P&L curve, Breakeven points, Max Profit, and Max Risk.
- **Preset Strategies**: Instant setup for Long Call/Put, Bull Call Spread, Bear Put Spread, Straddle, Strangle, Iron Condor, Calendar Spread, and Butterfly.
- **Aggregate Greeks Dashboard**: Combined Portfolio Delta ($\Sigma\Delta$), Gamma ($\Sigma\Gamma$), Theta ($\Sigma\Theta$), and Vega ($\Sigma\mathcal{V}$).

### 4. Historical Trade Backtesting
- **Multi-Period Simulation**: Backtest options strategies over 1 Month, 3 Months, 6 Months, 1 Year, or 2 Years.
- **Performance Metrics**: Overall Win Rate %, Total Return %, Profit Factor, Max Drawdown %, and Sharpe Ratio.
- **Trade Log & Equity Curve**: Recharts-powered chronological portfolio balance chart and individual trade breakdown.

### 5. Neural Price & IV Predictor
- **TensorFlow.js Model**: In-browser client-side neural network trained on normalized sequential price and volatility features.
- **Price Forecasting**: 5 to 30-day forecast trajectories with 68% (1$\sigma$) and 95% (2$\sigma$) confidence intervals.
- **Expected Move Bounds**: Derived from ATM Implied Volatility:
  $$\text{Expected Move} = S_0 \times \sigma \times \sqrt{\frac{\text{DTE}}{365}}$$

### 6. Real-Time Market Scanner
- **Top Ticker Coverage**: Scans high-liquidity assets (SPY, QQQ, AAPL, NVDA, TSLA, MSFT, AMD, AMZN, META, GOOGL).
- **Metric Categorization**: Filter by IV Rank, High Options Volume, Unusual Put/Call ratios, and Breakout candidates.
- **One-Click Deep Dive**: Seamless transition from scanner results directly into Live Analysis.

### 7. Interactive Quant Sandbox
- **Code Execution Environment**: Run quant algorithms directly in the browser.
- **Ready-to-Use Algorithmic Templates**:
  - *Black-Scholes-Merton Options Pricer & Greeks Engine*
  - *Monte Carlo Geometric Brownian Motion Asset Paths*
  - *Binomial CRR Lattice Model for American Options*
  - *Historical Volatility vs Implied Volatility Cone*
  - *GARCH(1,1) Volatility Clustering Estimation*

### 8. Awesome Quant Library
- **Comprehensive Knowledge Base**: Interactive searchable quant library covering:
  - Theoretical Formulas & Definitions (BSM, Ito's Lemma, GARCH, Kelly Criterion, SVI)
  - Essential Python Libraries (`numpy`, `pandas`, `scipy`, `quantlib`, `yfinance`, `ta-lib`, `arch`)
  - Seminal Books & Quant Papers (Hull, Natenberg, Gatheral, Taleb, Wilmott)

### 9. Cloud History & Multi-Format Reporting
- **Firebase Firestore Synchronization**: Real-time cloud history for authenticated and anonymous users.
- **Export Options**:
  - **PDF Export**: Clean multi-page PDF formatted with jsPDF and jsPDF-AutoTable.
  - **CSV Export**: Standardized tabular metrics ready for Excel or Python analysis.
  - **JSON Export**: Complete raw data payload for algorithmic pipelines.
  - **Text Report**: Executive summary report ready for sharing.

---

## 📐 Quantitative & Mathematical Formulations

### 1. Black-Scholes-Merton Formula
For European options non-dividend paying stock:

$$C(S, t) = S_0 N(d_1) - K e^{-r T} N(d_2)$$

$$P(S, t) = K e^{-r T} N(-d_2) - S_0 N(-d_1)$$

Where:
$$d_1 = \frac{\ln(S_0 / K) + (r + \frac{\sigma^2}{2}) T}{\sigma \sqrt{T}}$$

$$d_2 = d_1 - \sigma \sqrt{T}$$

### 2. Analytical Greeks Formulae

| Greek | Call Option Formula | Put Option Formula | Economic Meaning |
| :--- | :--- | :--- | :--- |
| **Delta ($\Delta$)** | $N(d_1)$ | $N(d_1) - 1$ | First derivative of price w.r.t underlying spot ($\frac{\partial V}{\partial S}$) |
| **Gamma ($\Gamma$)** | $\frac{N'(d_1)}{S_0 \sigma \sqrt{T}}$ | $\frac{N'(d_1)}{S_0 \sigma \sqrt{T}}$ | Second derivative w.r.t spot / Rate of delta change ($\frac{\partial^2 V}{\partial S^2}$) |
| **Theta ($\Theta$)** | $-\frac{S_0 N'(d_1) \sigma}{2\sqrt{T}} - r K e^{-rT} N(d_2)$ | $-\frac{S_0 N'(d_1) \sigma}{2\sqrt{T}} + r K e^{-rT} N(-d_2)$ | Time decay per calendar day ($\frac{\partial V}{\partial t}$) |
| **Vega ($\mathcal{V}$)** | $S_0 \sqrt{T} N'(d_1)$ | $S_0 \sqrt{T} N'(d_1)$ | Sensitivity per 1% change in implied volatility ($\frac{\partial V}{\partial \sigma}$) |
| **Rho ($\rho$)** | $K T e^{-rT} N(d_2)$ | $-K T e^{-rT} N(-d_2)$ | Sensitivity to interest rate shifts ($\frac{\partial V}{\partial r}$) |

---

## 🛠 Technology Stack

- **Frontend Core**: React 18, TypeScript 5.8, Vite 6.2
- **Styling & UI**: Tailwind CSS, Lucide React Icons
- **Data Visualization**: D3.js v7 (3D Surface, Custom SVG Paths), Recharts v2 (Charts & Equity Curves)
- **Machine Learning**: TensorFlow.js v4.22
- **Artificial Intelligence**: Google Gen AI SDK (`@google/genai`) with Gemini 2.5 Flash / Pro
- **Document Generation**: jsPDF, jsPDF-AutoTable
- **Cloud & Auth**: Firebase Authentication, Cloud Firestore
- **Tooling**: ESLint, Vite Proxy, TypeScript Compiler

---

## 🚀 Installation & Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/optigreek-advisor.git
cd optigreek-advisor

# 2. Install dependencies
npm install

# 3. Create .env file (see Configuration section below)
cp .env.example .env

# 4. Start the development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory:

```env
# Gemini API Key for quantitative analysis and strategy generation
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration (Optional if pre-configured via firebase-applet-config.json)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 📂 Project Directory Structure

```
├── components/                       # User Interface Components
│   ├── AnalysisView.tsx              # Main Live Analysis screen
│   ├── AwesomeQuantView.tsx          # Awesome Quant knowledge base
│   ├── BacktestView.tsx              # Historical trade simulation
│   ├── GreeksCard.tsx                # Interactive Greeks inspector
│   ├── HistoryView.tsx               # Firestore saved runs & history
│   ├── MarketScannerView.tsx         # Multi-ticker scanner & screener
│   ├── PredictionEngineView.tsx      # TensorFlow.js neural predictor
│   ├── QuantSandboxView.tsx          # Live code editor & execution
│   ├── QuantToolsSidebar.tsx         # Quant toolbox drawer
│   ├── StrategyBuilderView.tsx       # Custom multi-leg builder & payoff
│   ├── TickerNewsFeed.tsx            # Real-time sentiment & news
│   ├── VisualConfidenceScoreCard.tsx # Factor confidence radar
│   └── VolatilitySurfacePlot.tsx     # D3 3D Volatility surface & smile
├── docs/                             # In-Depth Documentation
│   ├── ARCHITECTURE.md               # System & Dataflow Architecture
│   └── QUANT_MODELS.md               # Math, Models & Algorithmic Specs
├── services/                         # Quantitative Engines & Services
│   ├── backtestEngine.ts             # Trade simulation & Monte Carlo
│   ├── expirationUtils.ts            # Options expiration logic & DTE
│   ├── exportUtils.ts                # PDF, CSV, JSON, TXT generator
│   ├── firebase.ts                   # Firebase SDK initialization
│   ├── gemini.ts                     # Gemini API quantitative logic
│   ├── historyService.ts             # Firestore CRUD queries
│   ├── optionsChainValidator.ts      # Options data sanity validator
│   └── optionsOptimizer.ts           # Black-Scholes & Greeks math
├── types.ts                          # Global TypeScript declarations
├── FirebaseProvider.tsx              # React Context for Auth & User state
├── vite.config.ts                    # Vite config with market data proxy
├── package.json                      # NPM dependencies and scripts
└── metadata.json                     # Application platform metadata
```

---

## 📊 Export Capabilities & Reporting

OptiGreek Advisor includes native reporting utilities without external server dependencies:
- **PDF Report (`exportAsPDF`)**: Generates an institutional-grade PDF containing executive summary, Greeks matrix table, risk factors, and recommended legs.
- **CSV Data Export (`exportAsCSV`)**: Formats all key indicators into standard comma-separated values for spreadsheet integration.
- **JSON Payload (`exportAsJSON`)**: Exports full raw quantitative state for algorithmic backtesting pipelines.
- **Text Summary (`exportAsTextReport`)**: Formatted plain-text clipboard report.

---

## 🔒 Security & Firestore Rules

Data security is enforced at the database level via Firestore security rules (`firestore.rules`):
- Users can only read and write their own analyses and trading history (`auth.uid == resource.data.userId`).
- Public reads are strictly restricted to authenticated and anonymous user sessions.

---

## ⚠️ Disclaimer

*OptiGreek Advisor is built for educational, quantitative research, and decision-support purposes only. Options trading involves substantial risk of loss and is not suitable for all investors. Mathematical models and historical simulations do not guarantee future performance. Always practice strict risk management.*
