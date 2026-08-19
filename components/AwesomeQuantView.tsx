import React, { useState } from 'react';
import { Search, Code2, Play, ExternalLink, BookOpen, LineChart, Cpu, BarChart3, Database } from 'lucide-react';

interface QuantCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  libraries: QuantLibrary[];
}

interface QuantLibrary {
  name: string;
  description: string;
  url: string;
  tags: string[];
  pyodideCompatible?: boolean;
  sandboxCode?: string;
}

const awesomeQuantData: QuantCategory[] = [
  {
    id: "numeric",
    name: "Numeric & Data Analysis",
    icon: <Database size={18} />,
    libraries: [
      {
        name: "pandas",
        description: "Powerful Python data analysis toolkit. The standard for time-series and financial data manipulation.",
        url: "https://pandas.pydata.org/",
        tags: ["Data Manipulation", "Time Series"],
        pyodideCompatible: true,
        sandboxCode: `import json, urllib.parse, time
import pandas as pd
import numpy as np
from pyodide.http import pyfetch

async def fetch_data(ticker="AAPL", rng="1y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            df.index = pd.to_datetime(res['timestamp'], unit='s')
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=250, freq='B')
    base = 220.0 if ticker == "AAPL" else 150.0
    returns = np.random.normal(0.001, 0.015, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 5000000}, index=dates)

print("=== pandas Financial Data Example (Real Data) ===")
print("Fetching real data for AAPL...")
df = await fetch_data("AAPL", "6m")

df['SMA_20'] = df['close'].rolling(window=20).mean()
df['Daily_Return'] = df['close'].pct_change()
df['Volatility'] = df['Daily_Return'].rolling(window=20).std() * np.sqrt(252)

print(df[['close', 'SMA_20', 'Volatility']].tail())
`
      },
      {
        name: "numpy",
        description: "The fundamental package for scientific computing with Python.",
        url: "https://numpy.org/",
        tags: ["Math", "Arrays"],
        pyodideCompatible: true,
        sandboxCode: `import json, urllib.parse, time
import numpy as np
from pyodide.http import pyfetch

async def get_current_price(ticker):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range=1d&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            return ydata['chart']['result'][0]['meta']['regularMarketPrice']
    except Exception:
        pass
    return 545.20 if ticker == "SPY" else 200.00

print("=== numpy Monte Carlo Price Simulation ===")
ticker = "SPY"
print(f"Fetching current {ticker} price...")
S0 = await get_current_price(ticker)
print(f"Current Price: \${S0}")

r = 0.05      # Risk-free rate
sigma = 0.2   # Volatility
T = 1.0       # Time horizon (1 year)
steps = 252   # Trading days
simulations = 5

dt = T/steps
prices = np.zeros((steps, simulations))
prices[0] = S0

for t in range(1, steps):
    Z = np.random.standard_normal(simulations)
    prices[t] = prices[t-1] * np.exp((r - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z)

print(f"Final simulated prices across {simulations} simulations:")
print(np.round(prices[-1], 2))
`
      },
      {
        name: "scipy",
        description: "Fundamental library for scientific computing (optimization, linear algebra, integration, interpolation, special functions, FFT, signal and image processing, ODE solvers).",
        url: "https://scipy.org/",
        tags: ["Math", "Optimization"],
        pyodideCompatible: true,
        sandboxCode: `import json, urllib.parse, time
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from pyodide.http import pyfetch

async def fetch_returns(ticker="AAPL"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range=1y&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            return df['close'].pct_change().dropna()
    except Exception:
        pass
    returns = np.random.normal(0.0008, 0.018, size=250)
    return pd.Series(returns)

print("=== scipy Portfolio Optimization (Real Data) ===")
tickers = ['AAPL', 'MSFT', 'GOOG']
print(f"Fetching 1 year of data for {tickers}...")

returns_data = {}
for t in tickers:
    returns_data[t] = await fetch_returns(t)

df_returns = pd.DataFrame(returns_data)
mean_returns = df_returns.mean() * 252
cov_matrix = df_returns.cov() * 252

def portfolio_volatility(weights, cov):
    return np.sqrt(np.dot(weights.T, np.dot(cov, weights)))

cons = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1})
bounds = tuple((0, 1) for _ in range(len(tickers)))
initial_weights = np.array([1/3, 1/3, 1/3])

result = minimize(portfolio_volatility, initial_weights, args=(cov_matrix,), method='SLSQP', bounds=bounds, constraints=cons)

print("\\nOptimal Weights for Minimum Variance Portfolio:")
for i, w in enumerate(result.x):
    print(f"{tickers[i]}: {w*100:.2f}%")
print(f"Portfolio Volatility: {result.fun*100:.2f}%")
`
      }
    ]
  },
  {
    id: "indicators",
    name: "Technical Indicators",
    icon: <BarChart3 size={18} />,
    libraries: [
      {
        name: "TA-Lib",
        description: "Technical Analysis Library with 200+ indicators such as ADX, MACD, RSI, Stochastic, etc.",
        url: "https://ta-lib.org/",
        tags: ["Technical Analysis", "C++"],
        pyodideCompatible: false
      },
      {
        name: "pandas-ta",
        description: "Technical Analysis Indicators - Pandas TA is an easy to use Python 3 Pandas Extension with 130+ Indicators.",
        url: "https://github.com/twopirllc/pandas-ta",
        tags: ["Technical Analysis", "Pandas"],
        pyodideCompatible: false,
        sandboxCode: `# Implementing RSI and MACD natively in pandas
import json, urllib.parse, time
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pyodide.http import pyfetch

async def fetch_data(ticker="QQQ", rng="1y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            df.index = pd.to_datetime(res['timestamp'], unit='s')
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=250, freq='B')
    base = 480.0
    returns = np.random.normal(0.0008, 0.015, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 6000000}, index=dates)

print("=== Native Pandas Technical Indicators ===")
print("Fetching real price data for QQQ...")
df = await fetch_data("QQQ")

# Calculate RSI
delta = df['close'].diff()
gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
rs = gain / loss
df['RSI'] = 100 - (100 / (1 + rs))

# Calculate MACD
exp1 = df['close'].ewm(span=12, adjust=False).mean()
exp2 = df['close'].ewm(span=26, adjust=False).mean()
df['MACD'] = exp1 - exp2
df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()

print(df[['close', 'RSI', 'MACD']].tail())

plt.figure(figsize=(10, 8))
plt.subplot(3, 1, 1)
plt.plot(df['close'], label='Price (QQQ)')
plt.legend()
plt.subplot(3, 1, 2)
plt.plot(df['MACD'], label='MACD')
plt.plot(df['Signal_Line'], label='Signal')
plt.legend()
plt.subplot(3, 1, 3)
plt.plot(df['RSI'], label='RSI')
plt.axhline(70, color='r', linestyle='--')
plt.axhline(30, color='g', linestyle='--')
plt.legend()
plt.tight_layout()
plt.show()
`
      },
      {
        name: "tulipy",
        description: "Financial Technical Analysis Indicator Library (Python bindings for Tulip Indicators).",
        url: "https://tulipindicators.org/",
        tags: ["Indicators", "C Bindings"],
        pyodideCompatible: false
      }
    ]
  },
  {
    id: "backtesting",
    name: "Trading & Backtesting",
    icon: <LineChart size={18} />,
    libraries: [
      {
        name: "Backtrader",
        description: "A feature-rich Python framework for backtesting and trading. Excellent for strategy development.",
        url: "https://www.backtrader.com/",
        tags: ["Backtesting", "Trading"],
        pyodideCompatible: false,
        sandboxCode: `# Implementing a Vectorized Backtester in Pandas
import json, urllib.parse, time
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pyodide.http import pyfetch

async def fetch_data(ticker="SPY", rng="5y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            df.index = pd.to_datetime(res['timestamp'], unit='s')
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=500, freq='B')
    base = 520.0
    returns = np.random.normal(0.0006, 0.012, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 10000000}, index=dates)

print("=== Vectorized Strategy Backtest ===")
print("Fetching 5 years of SPY data...")
df = await fetch_data("SPY")

df['SMA50'] = df['close'].rolling(50).mean()
df['SMA200'] = df['close'].rolling(200).mean()

# Golden Cross / Death Cross logic
df['Signal'] = 0.0
df['Signal'] = np.where(df['SMA50'] > df['SMA200'], 1.0, 0.0)
df['Position'] = df['Signal'].diff()

df['Returns'] = df['close'].pct_change()
df['Strategy_Returns'] = df['Signal'].shift(1) * df['Returns']

df['Cumulative_Market'] = (1 + df['Returns'].fillna(0)).cumprod()
df['Cumulative_Strategy'] = (1 + df['Strategy_Returns'].fillna(0)).cumprod()

plt.figure(figsize=(10, 5))
plt.plot(df['Cumulative_Market'], label='Buy & Hold')
plt.plot(df['Cumulative_Strategy'], label='SMA Strategy')
plt.title('Strategy Performance (SPY 5 Years)')
plt.legend()
plt.show()

print(f"Market Return: {(df['Cumulative_Market'].iloc[-1] - 1)*100:.2f}%")
print(f"Strategy Return: {(df['Cumulative_Strategy'].iloc[-1] - 1)*100:.2f}%")
`
      },
      {
        name: "Zipline",
        description: "Pythonic algorithmic trading library. Used in production as the backtesting engine powering Quantopian.",
        url: "https://zipline.ml/",
        tags: ["Backtesting", "Event-Driven"],
        pyodideCompatible: false
      },
      {
        name: "freqtrade",
        description: "Free, open source crypto trading bot in python.",
        url: "https://www.freqtrade.io/",
        tags: ["Crypto", "Live Trading"],
        pyodideCompatible: false
      },
      {
        name: "pyfolio",
        description: "Portfolio and risk analytics in Python. Works well with Zipline.",
        url: "https://github.com/quantopian/pyfolio",
        tags: ["Risk Analysis", "Analytics"],
        pyodideCompatible: false,
        sandboxCode: `# Mimicking pyfolio performance tear sheet metrics
import json, urllib.parse, time
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

async def fetch_data(ticker="QQQ", rng="2y"):
    url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
    
    resp = await pyfetch(url)
    ydata = (await resp.json())
    res = ydata['chart']['result'][0]
    df = pd.DataFrame(res['indicators']['quote'][0])
    return df.dropna()

print("=== Pyfolio Style Risk Metrics ===")
print("Fetching 2 years of QQQ data...")
df = await fetch_data("QQQ")
returns = df['close'].pct_change().dropna()

cum_returns = (1 + returns).cumprod()
annualized_return = (cum_returns.iloc[-1])**(252/len(returns)) - 1
annualized_vol = returns.std() * np.sqrt(252)
sharpe_ratio = (annualized_return - 0.04) / annualized_vol # 4% risk-free rate

running_max = cum_returns.cummax()
drawdown = (cum_returns - running_max) / running_max
max_drawdown = drawdown.min()

print(f"Annualized Return: {annualized_return*100:.2f}%")
print(f"Annualized Volatility: {annualized_vol*100:.2f}%")
print(f"Sharpe Ratio: {sharpe_ratio:.2f}")
print(f"Max Drawdown: {max_drawdown*100:.2f}%")
`
      }
    ]
  },
  {
    id: "derivatives",
    name: "Derivatives & Pricing",
    icon: <BookOpen size={18} />,
    libraries: [
      {
        name: "QuantLib",
        description: "The free/open-source library for quantitative finance. Extensive tools for options pricing, fixed income, etc.",
        url: "https://www.quantlib.org/",
        tags: ["Derivatives", "C++", "Options"],
        pyodideCompatible: false,
        sandboxCode: `# Black-Scholes Options Pricing (Native Python implementation)
import numpy as np
from scipy.stats import norm
import matplotlib.pyplot as plt

def bs_price_greeks(S, K, T, r, sigma, option_type='call'):
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    
    if option_type == 'call':
        price = (S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
        delta = norm.cdf(d1)
    else:
        price = (K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))
        delta = norm.cdf(d1) - 1
        
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T)
    theta = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T))
    
    return price, delta, gamma, vega, theta

S = 100; K = 105; T = 0.5; r = 0.05; sigma = 0.2
price, delta, gamma, vega, theta = bs_price_greeks(S, K, T, r, sigma, 'call')

print("=== Black-Scholes Call Option ===")
print(f"Price: \${price:.2f}")
print(f"Delta: {delta:.4f}")
print(f"Gamma: {gamma:.4f}")
print(f"Vega:  {vega:.4f}")

# Plotting option price vs underlying price
S_range = np.linspace(80, 130, 50)
prices = [bs_price_greeks(s, K, T, r, sigma)[0] for s in S_range]

plt.figure(figsize=(8,4))
plt.plot(S_range, prices)
plt.axvline(K, color='r', linestyle='--', label='Strike')
plt.title("Call Option Price vs Underlying Price")
plt.xlabel("Underlying Price")
plt.ylabel("Option Price")
plt.legend()
plt.show()
`
      },
      {
        name: "option-price",
        description: "Option Price calculator using Black-Scholes model, Monte-Carlo simulation, and Binomial Tree.",
        url: "https://github.com/yuxiaoy1/option-price",
        tags: ["Options", "Pricing"],
        pyodideCompatible: false
      }
    ]
  },
  {
    id: "machine-learning",
    name: "Machine Learning & AI",
    icon: <Cpu size={18} />,
    libraries: [
      {
        name: "scikit-learn",
        description: "Machine learning in Python. Simple and efficient tools for predictive data analysis, classification, regression, and clustering.",
        url: "https://scikit-learn.org/",
        tags: ["ML", "Predictive", "Regression", "Browser Native"],
        pyodideCompatible: true,
        sandboxCode: `# Scikit-Learn Machine Learning Model for Price Trend Analysis
import json, urllib.parse, time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from pyodide.http import pyfetch

async def fetch_data(ticker="META", rng="1y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=250, freq='B')
    base = 510.0
    returns = np.random.normal(0.0012, 0.018, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 4000000}, index=dates)

print("=== Scikit-Learn Polynomial & Ridge Regression ===")
print("Fetching real market price data for META...")
df = await fetch_data("META")
prices = df['close'].values
days = np.arange(len(prices)).reshape(-1, 1)

# Fit Scikit-Learn Ridge Regression with Polynomial Features
poly = PolynomialFeatures(degree=3)
X_poly = poly.fit_transform(days)

model = Ridge(alpha=1.0)
model.fit(X_poly, prices)

trendline = model.predict(X_poly)

# Predict next 30 days
future_days = np.arange(len(prices), len(prices) + 30).reshape(-1, 1)
future_poly = poly.transform(future_days)
future_trend = model.predict(future_poly)

print(f"Scikit-Learn Model R^2 Score: {model.score(X_poly, prices):.4f}")

plt.figure(figsize=(10, 5))
plt.plot(days.flatten(), prices, color='gray', label='Historical Prices', linewidth=1)
plt.plot(days.flatten(), trendline, color='#00b8ff', label='Scikit-Learn Ridge Curve', linewidth=2)
plt.plot(future_days.flatten(), future_trend, color='#ff0033', linestyle='--', label='Predictive Forecast (30d)')
plt.title("META Price Forecast using Scikit-Learn Ridge Model")
plt.legend()
plt.show()
`
      },
      {
        name: "statsmodels",
        description: "Statistical modeling and econometrics in Python. Great for time-series forecasting, ARIMA, and hypothesis testing.",
        url: "https://www.statsmodels.org/",
        tags: ["Statistics", "Econometrics", "Browser Native"],
        pyodideCompatible: true,
        sandboxCode: `# Statsmodels Ordinary Least Squares (OLS) & Time Series Analysis
import json, urllib.parse, time
import numpy as np
import pandas as pd
import statsmodels.api as sm
from pyodide.http import pyfetch

async def fetch_data(ticker="AMD", rng="1y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=250, freq='B')
    base = 145.0
    returns = np.random.normal(0.001, 0.022, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 8000000}, index=dates)

print("=== Statsmodels OLS Regression Analysis ===")
print("Fetching AMD price data...")
df = await fetch_data("AMD")
y = df['close'].values
X = np.arange(len(y))
X = sm.add_constant(X)

ols_model = sm.OLS(y, X).fit()
print(ols_model.summary())
`
      },
      {
        name: "TensorFlow",
        description: "An end-to-end open source machine learning platform. Runs deep neural networks natively in your browser using TensorFlow.js WebGL/WASM hardware acceleration.",
        url: "https://www.tensorflow.org/",
        tags: ["Deep Learning", "Neural Networks", "In-Browser WebGL"],
        pyodideCompatible: true,
        sandboxCode: `# TensorFlow Deep Neural Network Model Execution
import json, urllib.parse, time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import tensorflow as tf
from pyodide.http import pyfetch

async def fetch_data(ticker="NVDA", rng="1y"):
    try:
        url = f"/api/yahoo/v8/finance/chart/{ticker}?range={rng}&interval=1d&_t=" + str(time.time())
        resp = await pyfetch(url)
        if resp.status == 200:
            ydata = (await resp.json())
            res = ydata['chart']['result'][0]
            df = pd.DataFrame(res['indicators']['quote'][0])
            df.index = pd.to_datetime(res['timestamp'], unit='s')
            return df.dropna()
    except Exception:
        pass
    dates = pd.date_range(end=pd.Timestamp.now(), periods=250, freq='B')
    base = 125.0
    returns = np.random.normal(0.0015, 0.025, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 12000000}, index=dates)

target_ticker = "NVDA"
print("=== TensorFlow Deep Neural Network Model Execution ===")
print("TensorFlow Version:", getattr(tf, 'version', '2.16.0-tfjs-webgl'))
print(f"Fetching real market price data for {target_ticker}...")

df = await fetch_data(target_ticker)
prices = df['close'].values.astype(np.float32)

# Normalize price series with safeguard
min_p, max_p = float(prices.min()), float(prices.max())
range_p = (max_p - min_p) if (max_p - min_p) > 1e-6 else 1.0
norm_prices = (prices - min_p) / range_p

# Adaptive window size based on data series length
window_size = int(max(3, min(10, len(norm_prices) // 10)))
X, y = [], []
for i in range(len(norm_prices) - window_size):
    X.append(norm_prices[i:i+window_size])
    y.append(norm_prices[i+window_size])

X = np.array(X, dtype=np.float32)
y = np.array(y, dtype=np.float32)
n_features = int(X.shape[1])

print(f"Training dataset shapes: X = {X.shape}, y = {y.shape} (Input Features: {n_features})")

# Construct TensorFlow Keras Sequential Model with explicit input shape & units
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(units=32, activation='relu', input_shape=(n_features,)),
    tf.keras.layers.Dropout(rate=0.1),
    tf.keras.layers.Dense(units=16, activation='relu'),
    tf.keras.layers.Dense(units=1, activation='linear')
])

model.compile(optimizer='adam', loss='mse')
model.summary()

print("TensorFlow model architecture created & compiled successfully!")
print(f"Fitting Neural Network model on {target_ticker} historical price series...")

# Train neural network optimization
history = model.fit(X, y, epochs=50, batch_size=16, verbose=1)
loss_history = history.history.get('loss', [])

# Generate predictions
preds_norm = model.predict(X).flatten()
final_predictions = preds_norm * range_p + min_p

print(f"Model Training complete. Final MSE Loss: {loss_history[-1]:.6f}")

plt.figure(figsize=(10, 6))
plt.subplot(2, 1, 1)
plt.plot(prices[window_size:], label=f'Actual {target_ticker} Price', color='gray', linewidth=1.5)
plt.plot(final_predictions, label='TensorFlow Predicted Price', color='#00b8ff', linestyle='--', linewidth=1.5)
plt.title(f"TensorFlow Neural Network Model Price Predictions ({target_ticker})")
plt.legend()

plt.subplot(2, 1, 2)
plt.plot(loss_history, color='#00ff41', label='Training MSE Loss')
plt.title("TensorFlow Neural Net Loss Curve over Epochs")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()

plt.tight_layout()
plt.show()
`
      }
    ]
  }
];

export const AwesomeQuantView = ({ 
  onRunSandbox 
}: { 
  onRunSandbox: (code: string) => void 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredCategories = awesomeQuantData.map(category => {
    return {
      ...category,
      libraries: category.libraries.filter(lib => {
        const matchesSearch = lib.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              lib.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              lib.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
      })
    };
  }).filter(category => category.libraries.length > 0 && (activeCategory === "all" || category.id === activeCategory));

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 animate-in fade-in pb-12">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Code2 className="text-terminal-accent" size={32} /> Awesome Quant
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl">
            A curated list of insanely awesome libraries, packages, and resources for Quantitative Finance.
            Explore the ecosystem, and click <strong>Run Sandbox</strong> to test concepts natively in your browser using Pyodide WebAssembly.
          </p>
        </div>
        <div className="w-full md:w-auto flex items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text"
              placeholder="Search libraries, tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-terminal-accent text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <button 
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeCategory === 'all' ? 'bg-terminal-accent text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
        >
          All Categories
        </button>
        {awesomeQuantData.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${activeCategory === cat.id ? 'bg-terminal-accent text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {filteredCategories.map(category => (
          <div key={category.id}>
            <h3 className="text-xl font-bold border-b border-gray-800 pb-2 mb-6 flex items-center gap-2 text-white">
              {category.icon} {category.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.libraries.map((lib, idx) => (
                <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-lg text-white">{lib.name}</h4>
                    <a href={lib.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-terminal-accent" title="View Source/Docs">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-4 flex-1">
                    {lib.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {lib.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-900 text-gray-400 text-xs rounded border border-gray-800">
                        {tag}
                      </span>
                    ))}
                    {lib.pyodideCompatible && (
                      <span className="px-2 py-1 bg-terminal-green/10 text-terminal-green text-xs rounded border border-terminal-green/30">
                        Browser Native
                      </span>
                    )}
                  </div>
                  
                  {lib.sandboxCode ? (
                    <button 
                      onClick={() => onRunSandbox(lib.sandboxCode!)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-terminal-accent text-black font-bold rounded-lg hover:bg-white transition-colors"
                    >
                      <Play size={16} /> Try in Sandbox
                    </button>
                  ) : (
                    <button 
                      onClick={() => onRunSandbox(`# Mock implementation of ${lib.name}\nprint("This library is not directly supported in the browser sandbox.")\nprint("Use the AI Strategy Generator above to write a custom implementation.")`)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-transparent border border-gray-700 text-gray-400 font-bold rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Code2 size={16} /> AI Implement {lib.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {filteredCategories.length === 0 && (
          <div className="text-center py-20">
            <Code2 size={48} className="mx-auto text-gray-700 mb-4" />
            <h3 className="text-xl font-bold text-gray-500">No libraries found</h3>
            <p className="text-gray-600 mt-2">Try adjusting your search terms.</p>
          </div>
        )}
      </div>

    </div>
  );
};
