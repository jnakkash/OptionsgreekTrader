# Quantitative Finance & Options Models 📐

This document provides the mathematical specifications, pricing equations, Greeks derivations, and volatility surface modeling utilized throughout **OptiGreek Advisor**.

---

## 1. Black-Scholes-Merton (BSM) Options Pricing

Assuming the underlying asset price follows a Geometric Brownian Motion (GBM) with constant volatility $\sigma$ and risk-free interest rate $r$:

$$dS_t = \mu S_t dt + \sigma S_t dW_t$$

The price of a European Call option $C(S, K, T, r, \sigma)$ and Put option $P(S, K, T, r, \sigma)$ are given by:

$$C = S_0 N(d_1) - K e^{-r T} N(d_2)$$

$$P = K e^{-r T} N(-d_2) - S_0 N(-d_1)$$

Where the standard normal cumulative distribution function is:

$$N(x) = \frac{1}{\sqrt{2\pi}} \int_{-\infty}^x e^{-\frac{u^2}{2}} du$$

And intermediate variables $d_1, d_2$ are defined as:

$$d_1 = \frac{\ln(S_0 / K) + \left(r + \frac{\sigma^2}{2}\right) T}{\sigma \sqrt{T}}$$

$$d_2 = d_1 - \sigma \sqrt{T}$$

---

## 2. Analytical Greeks Formulations

### First-Order Greeks

#### Delta ($\Delta$)
Sensitivity of option price to changes in underlying asset price:
$$\Delta_{\text{Call}} = \frac{\partial C}{\partial S} = N(d_1) \in [0, 1]$$
$$\Delta_{\text{Put}} = \frac{\partial P}{\partial S} = N(d_1) - 1 \in [-1, 0]$$

#### Vega ($\mathcal{V}$)
Sensitivity of option price to a 1% change in implied volatility $\sigma$:
$$\mathcal{V} = \frac{\partial C}{\partial \sigma} = \frac{\partial P}{\partial \sigma} = S_0 \sqrt{T} N'(d_1) = S_0 \sqrt{T} \frac{1}{\sqrt{2\pi}} e^{-\frac{d_1^2}{2}}$$

#### Theta ($\Theta$)
Sensitivity of option price with respect to the passage of time (calendar decay):
$$\Theta_{\text{Call}} = -\frac{S_0 N'(d_1) \sigma}{2\sqrt{T}} - r K e^{-rT} N(d_2)$$
$$\Theta_{\text{Put}} = -\frac{S_0 N'(d_1) \sigma}{2\sqrt{T}} + r K e^{-rT} N(-d_2)$$
*(Values are typically divided by 365 or 252 to represent daily theta decay).*

#### Rho ($\rho$)
Sensitivity of option price to changes in the risk-free interest rate:
$$\rho_{\text{Call}} = K T e^{-rT} N(d_2)$$
$$\rho_{\text{Put}} = -K T e^{-rT} N(-d_2)$$

---

### Second-Order Greeks

#### Gamma ($\Gamma$)
Rate of change of Delta with respect to changes in underlying spot price (curvature):
$$\Gamma = \frac{\partial^2 C}{\partial S^2} = \frac{\partial^2 P}{\partial S^2} = \frac{N'(d_1)}{S_0 \sigma \sqrt{T}}$$

---

## 3. Stochastic Volatility & Implied Volatility Surface

The continuous implied volatility surface $\sigma_{\text{IV}}(K, T)$ is parameterized as a function of log-moneyness $k = \ln(K / S_0)$ and time-to-expiration $T$:

$$\sigma_{\text{IV}}(k, T) = \sigma_{\text{ATM}}(T) + \text{Skew}(k, T) + \text{Curvature}(k, T)$$

### Skew Asymmetry
Reflects downside hedging crash-protection demand (negative skew):

$$\text{Skew}(k, T) = -\alpha \cdot \mathbf{1}_{\{k < 0\}} \left(\frac{k}{\sqrt{T + \tau_0}}\right) - \beta \cdot \mathbf{1}_{\{k \ge 0\}} \left(\frac{k}{\sqrt{T + \tau_0}}\right)$$

Where $\alpha > \beta$ captures the empirical asymmetry where OTM puts command higher implied volatility than equidistant OTM calls.

### Volatility Smile Curvature
$$\text{Curvature}(k, T) = \gamma \cdot \frac{k^2}{T + \tau_1}$$

---

## 4. Expected Move & Probability Distribution

Using the at-the-money implied volatility $\sigma_{\text{ATM}}$, the theoretical 1-standard-deviation ($\approx 68.2\%$) market expected move for expiration horizon $T$ (in days) is calculated as:

$$\text{Expected Move} (\$) = S_0 \times \sigma_{\text{ATM}} \times \sqrt{\frac{\text{DTE}}{365}}$$

Upper and lower bounds:
$$\text{Upper Bound} = S_0 + \text{Expected Move}$$
$$\text{Lower Bound} = S_0 - \text{Expected Move}$$

---

## 5. Backtest Performance Metrics

In the simulation engine (`services/backtestEngine.ts`), strategy metrics are calculated across $N$ simulated trades:

### Win Rate
$$\text{Win Rate} = \frac{\sum_{i=1}^N \mathbf{1}_{\{\text{PnL}_i > 0\}}}{N} \times 100\%$$

### Profit Factor
$$\text{Profit Factor} = \frac{\sum_{\text{PnL}_i > 0} \text{PnL}_i}{\left| \sum_{\text{PnL}_i < 0} \text{PnL}_i \right|}$$

### Maximum Drawdown (MDD)
$$\text{MDD} = \max_{t \in [0, T]} \left( \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t} \right) \times 100\%$$

### Sharpe Ratio
Assuming risk-free rate $r_f = 0$:
$$\text{Sharpe} = \frac{\mu_{\text{return}}}{\sigma_{\text{return}}} \times \sqrt{252}$$
