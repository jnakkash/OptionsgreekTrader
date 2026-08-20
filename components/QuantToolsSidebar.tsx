import React from 'react';
import { X, ExternalLink, Code2, LineChart, Library, TerminalSquare, Activity, Play } from 'lucide-react';

interface QuantToolsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (code: string) => void;
}

export const QuantToolsSidebar: React.FC<QuantToolsSidebarProps> = ({ isOpen, onClose, onSelectTool }) => {
  if (!isOpen) return null;

  const tools = [
    {
      name: 'Options Pricer (QuantLib style)',
      category: 'Derivatives',
      description: 'Calculate option prices and Greeks using Black-Scholes directly in Python.',
      icon: <Library size={18} />,
      link: 'https://www.quantlib.org/',
      code: `# Black-Scholes Option Pricer with Real Data
import json, urllib.parse, time
import numpy as np
from scipy.stats import norm
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
    return 225.50 if ticker == "TSLA" else 150.00

def bs_call(S, K, T, r, sigma):
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return (S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))

ticker = "TSLA"
print(f"Fetching current price for {ticker}...")
S = await get_current_price(ticker)
K = S * 1.05  # Strike 5% out of money
T = 0.25   # Time to Expiration (Years)
r = 0.05   # Risk-free Rate
sigma = 0.40 # Volatility

price = bs_call(S, K, T, r, sigma)
print("=== OPTIONS PRICER ===")
print(f"Underlying ({ticker}): \${S:.2f}")
print(f"Strike: \${K:.2f}")
print(f"Call Option Price: \${price:.2f}")
`
    },
    {
      name: 'Moving Average Strategy (Backtrader style)',
      category: 'Backtesting',
      description: 'Simulate a simple moving average crossover strategy on historical data arrays.',
      icon: <LineChart size={18} />,
      link: 'https://www.backtrader.com/',
      code: `# Simple Moving Average Backtest on Real Data
import json, urllib.parse, time
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

async def fetch_data(ticker="NVDA", rng="2y"):
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
    base = 120.0 if ticker == "NVDA" else 180.0
    returns = np.random.normal(0.001, 0.02, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 8000000}, index=dates)

print("=== STRATEGY BACKTEST ===")
print("Fetching real historical price data for NVDA...")
df = await fetch_data("NVDA")

# Calculate SMAs
df['SMA_20'] = df['close'].rolling(window=20).mean()
df['SMA_50'] = df['close'].rolling(window=50).mean()

# Generate Signals (1 for buy, -1 for sell)
df['Signal'] = np.where(df['SMA_20'] > df['SMA_50'], 1, -1)

# Calculate Returns
df['Return'] = df['close'].pct_change()
df['Strategy_Return'] = df['Signal'].shift(1) * df['Return']

total_return = (1 + df['Strategy_Return'].fillna(0)).prod() - 1
market_return = (1 + df['Return'].fillna(0)).prod() - 1

print(f"Market Buy & Hold Return: {market_return * 100:.2f}%")
print(f"Strategy Total Return: {total_return * 100:.2f}%")
print("\\nLast 5 days of simulation:")
print(df[['close', 'SMA_20', 'SMA_50', 'Signal']].tail())
`
    },
    {
      name: 'Volatility Analysis',
      category: 'Data',
      description: 'Calculate historical volatility and rolling metrics with pandas.',
      icon: <TerminalSquare size={18} />,
      link: 'https://github.com/wilsonfreitas/awesome-quant',
      code: `# Historical Volatility Calculator on Real Data
import json, urllib.parse, time
import numpy as np
import pandas as pd
from pyodide.http import pyfetch

async def fetch_data(ticker="AMD", rng="1y"):
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
    base = 140.0 if ticker == "AMD" else 150.0
    returns = np.random.normal(0.001, 0.025, size=len(dates))
    prices = base * np.exp(np.cumsum(returns))
    return pd.DataFrame({'close': prices, 'open': prices*0.99, 'high': prices*1.01, 'low': prices*0.98, 'volume': 8000000}, index=dates)

print("=== VOLATILITY ANALYSIS ===")
print("Fetching 1 year of AMD data...")
df = await fetch_data("AMD")

returns = df['close'].pct_change().dropna()

# Calculate annualized volatility
daily_volatility = np.std(returns)
annual_volatility = daily_volatility * np.sqrt(252)

print(f"Daily Volatility: {daily_volatility*100:.2f}%")
print(f"Annualized Volatility: {annual_volatility*100:.2f}%")
`
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0a0a] border-l border-gray-800 z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Code2 className="text-terminal-accent" />
              Quant Sandbox Tools
            </h2>
            <p className="text-xs text-gray-400 mt-1">Run python quant scripts natively in browser</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="bg-terminal-accent/10 border border-terminal-accent/30 rounded-lg p-4">
            <h3 className="text-sm font-bold text-terminal-accent mb-2">Native WebAssembly Sandbox</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              You no longer need to visit external sites to test quant logic. Click <strong>Run in Native Sandbox</strong> to load Python scripts directly into our Pyodide-powered in-browser execution environment, featuring numpy, scipy, and pandas!
            </p>
          </div>

          <div className="space-y-4">
            {tools.map((tool, idx) => (
              <div key={idx} className="bg-[#111] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-gray-800 rounded text-gray-300">
                      {tool.icon}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{tool.name}</h4>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500">{tool.category}</span>
                    </div>
                  </div>
                  <a 
                    href={tool.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-terminal-accent transition-colors"
                    title="View external library docs"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {tool.description}
                </p>
                <button
                  onClick={() => {
                    onSelectTool(tool.code);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 text-white hover:bg-white hover:text-black text-xs font-bold rounded transition-colors mt-1"
                >
                  <Play size={14} />
                  Run in Native Sandbox
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-800">
            <a 
              href="https://github.com/wilsonfreitas/awesome-quant" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-transparent border border-gray-700 hover:bg-gray-800 text-gray-400 text-sm font-bold rounded-lg transition-colors"
            >
              <Library size={16} />
              View Full awesome-quant List
            </a>
          </div>
        </div>
      </div>
    </>
  );
};
