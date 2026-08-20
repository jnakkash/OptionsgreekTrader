# System Architecture Documentation 🏛️

This document outlines the software architecture, component relationships, data flow, state management, and quantitative pipelines implemented in **OptiGreek Advisor**.

---

## 1. High-Level Component Hierarchy

```
App.tsx (Root Controller & Navigation)
├── FirebaseProvider.tsx (Auth Context & Session)
├── QuantToolsSidebar.tsx (Side Drawer Toolbox)
└── Main View Router (State-Driven: `mode`)
    ├── AnalysisView.tsx (`LIVE` Mode)
    │   ├── VisualConfidenceScoreCard.tsx (Factor Radar)
    │   ├── GreeksCard.tsx (Delta, Gamma, Theta, Vega, Rho, PnL simulation)
    │   ├── VolatilitySurfacePlot.tsx (D3 3D Surface & 2D Smile Engine)
    │   └── TickerNewsFeed.tsx (News & Sentiment Classifier)
    ├── StrategyBuilderView.tsx (`STRATEGY` Mode)
    │   ├── Leg Configuration Table
    │   ├── Payoff Graph Engine (SVG Dynamic Curve)
    │   └── Portfolio Aggregate Greeks Matrix
    ├── BacktestView.tsx (`BACKTEST` Mode)
    │   ├── Backtest Summary Metrics
    │   ├── Historical Equity Growth Curve (Recharts)
    │   └── Detailed Trade Log Table
    ├── PredictionEngineView.tsx (`PREDICT` Mode)
    │   ├── TensorFlow.js Sequential Price Predictor
    │   ├── Expected Move Cone (68% & 95% Confidence)
    │   └── Volatility Regime Forecaster
    ├── MarketScannerView.tsx (`SCANNER` Mode)
    │   ├── Multi-Ticker Filter Grid
    │   └── Deep-Dive Quick Launcher
    ├── QuantSandboxView.tsx (`SANDBOX` Mode)
    │   ├── Code Editor & Real-Time Output Console
    │   └── Quant Algorithm Templates
    ├── AwesomeQuantView.tsx (`AWESOME` Mode)
    │   └── Filterable Quant Formula & Paper Library
    └── HistoryView.tsx (`HISTORY` Mode)
        └── Firestore Saved Runs & Multi-Format Exporter
```

---

## 2. Quantitative Calculation Pipeline

### Mathematical Engine (`services/optionsOptimizer.ts`)
The quantitative module provides analytical calculation functions:
1. **`calculateBlackScholesPrice`**: Analytical closed-form solution for European Call/Put pricing.
2. **`calculateGreeks`**: Analytical computation of first and second-order derivatives:
   - $\Delta$ (Delta)
   - $\Gamma$ (Gamma)
   - $\Theta$ (Theta)
   - $\mathcal{V}$ (Vega)
   - $\rho$ (Rho)
3. **`calculatePayoffCurve`**: Discrete step simulation ($S \in [0.5 \times S_0, 1.5 \times S_0]$) generating net portfolio profit/loss across strikes and contracts at expiration and current time $t$.
4. **`findBreakevens`**: Numerical root-finding detecting zero-crossing points on the expiration payoff curve.

---

## 3. D3 3D Volatility Surface Projection

### Projection Pipeline (`components/VolatilitySurfacePlot.tsx`)
```
Input: Spot Price (S0), Target Strike (K*), Target Expiration (T*)
  │
  ▼
Parametric Volatility Model Generation:
  σ(K, T) = ATM_IV(T) + Put_Skew(K/S, T) + Smile_Curvature(K/S, T)
  │
  ▼
3D Matrix Normalization:
  nx ∈ [-1.2, 1.2] (Strike Moneyness)
  ny ∈ [-1.2, 1.2] (Maturity Horizon DTE)
  nz ∈ [-0.9, 0.9] (Implied Volatility Height)
  │
  ▼
3D Affine Transformations:
  Step 1: Rotate Azimuth (Yaw angle around Z-axis)
  Step 2: Rotate Elevation (Pitch angle around X-axis)
  Step 3: Perspective Transformation with Focal Camera Distance
  │
  ▼
Painter's Algorithm Depth Sorting:
  Sort quadrilateral surface facets by average Z-depth (back-to-front rendering)
  │
  ▼
D3 Path Generator & SVG Rasterization:
  - Interpolate facet fills using chosen color scale (Neon, Viridis, Plasma, RdYlBu)
  - Superimpose interactive hover nodes and recommended target strike pin
```

---

## 4. Machine Learning & In-Browser Inference

### Neural Forecaster (`components/PredictionEngineView.tsx`)
- **Engine**: TensorFlow.js running WebGL/WASM acceleration client-side.
- **Model Topology**: Sequential deep architecture consisting of:
  - Dense layers with `relu` activation and L2 regularization.
  - Dropout layers (rate = 0.15) to prevent overfitting on price series.
  - Linear output layer predicting continuous normalized price trajectories.
- **Volatility Uncertainty Bands**: Superimposes standard deviation bands derived from analytical Black-Scholes implied volatility:
  $$\sigma_{\text{price}}(t) = S_0 \times \text{IV} \times \sqrt{\frac{t}{365}}$$

---

## 5. Persistence & Cloud Architecture

### Firebase Firestore Collections

#### Collection: `saved_analyses`
```json
{
  "id": "auto-generated-doc-id",
  "userId": "firebase-auth-uid",
  "ticker": "AAPL",
  "mode": "LIVE",
  "title": "AAPL Live Options Analysis",
  "timestamp": 1771234567890,
  "result": {
    "recommendation": { ... },
    "sentiment": { ... },
    "technicalIndicators": { ... },
    "optionsChain": [ ... ]
  }
}
```

### Security Enforcement
Enforced via `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saved_analyses/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

---

## 6. Exporting & Reporting Subsystems

The export system (`services/exportUtils.ts`) converts runtime quantitative state into shareable deliverables:
- **PDF Engine**: Uses `jspdf` and `jspdf-autotable` to construct formatted multi-page vector PDFs with custom headers, Greeks summary tables, risk scorecards, and strategy details.
- **CSV Formatter**: Flattens nested market data, Greeks metrics, and options chain strikes into RFC-4180 compliant CSV strings with automated browser download triggers.
- **JSON Exporter**: Serializes state with standardized metadata headers for consumption in Python / R algorithmic pipelines.
