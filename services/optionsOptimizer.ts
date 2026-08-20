import { Greeks } from '../types';
import { getClosestMonthlyExpiration } from './expirationUtils';
import { calcBlackScholesPrice, calcAnalyticalGreeks } from './quantEngine';

export interface OptionLeg {
  action: 'BUY' | 'SELL';
  optionType: 'CALL' | 'PUT';
  strike: number;
  expirationDte: number;
  expirationDate?: string; // Standard 3rd Friday date string e.g. "Aug 21, 2026"
  premium: number; // per share
  iv: number; // 0.25 = 25%
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionStrategyCandidate {
  strategyName: string;
  legs: OptionLeg[];
  netDebitOrCredit: number; // Positive = Debit, Negative = Credit
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  expectedPayoff: number; // Calculated across return distribution
  probabilityOfProfit: number; // percentage e.g. 64.2
  returnOnRiskPercent: number;
  var95: number; // VaR 95%
  cvar95: number; // CVaR 95% / Expected Shortfall
  eligibilityLabel: 'PREFERRED' | 'ELIGIBLE' | 'REJECTED' | 'NO_TRADE';
  invariantVerified: boolean;
  notes: string;
}

// Accounting invariant validation
export function verifyStrategyInvariants(
  strategyName: string,
  legs: OptionLeg[],
  netDebitOrCredit: number,
  maxProfit: number,
  maxLoss: number,
  breakevens: number[],
  spotPrice: number // Added spotPrice for arbitrage check
): boolean {
  if (legs.length === 0) return true; // Cash / NO TRADE legless candidate is valid

  // No-Arbitrage Checks (Call >= 0, Put >= 0, lower bound checks)
  for (const leg of legs) {
    if (leg.premium < 0) return false; // Premium cannot be negative
    if (leg.optionType === 'CALL' && leg.premium < Math.max(0, spotPrice - leg.strike)) return false; // Lower bound
    if (leg.optionType === 'PUT' && leg.premium < Math.max(0, leg.strike - spotPrice)) return false; // Lower bound
  }

  // 1. Verify premium arithmetic
  let calculatedDebit = 0;
  legs.forEach(leg => {
    if (leg.action === 'BUY') calculatedDebit += leg.premium;
    else calculatedDebit -= leg.premium;
  });

  if (Math.abs(calculatedDebit - netDebitOrCredit) > 0.05) {
    console.warn(`[Invariant Fail] Net debit mismatch: calc=${calculatedDebit}, provided=${netDebitOrCredit}`);
    return false;
  }

  // 2. Strategy specific checks
  if (strategyName.includes('Call Debit Spread') && legs.length === 2) {
    const buyLeg = legs.find(l => l.action === 'BUY' && l.optionType === 'CALL');
    const sellLeg = legs.find(l => l.action === 'SELL' && l.optionType === 'CALL');
    if (buyLeg && sellLeg && sellLeg.strike > buyLeg.strike) {
      const strikeWidth = sellLeg.strike - buyLeg.strike;
      const expectedMaxProfit = (strikeWidth * 100) - (netDebitOrCredit * 100);
      const expectedMaxLoss = netDebitOrCredit * 100;
      const expectedBreakeven = buyLeg.strike + netDebitOrCredit;

      if (Math.abs(maxProfit - expectedMaxProfit) > 1.0) return false;
      if (Math.abs(maxLoss - expectedMaxLoss) > 1.0) return false;
      if (Math.abs(breakevens[0] - expectedBreakeven) > 0.1) return false;
      
      if (netDebitOrCredit >= strikeWidth) {
        console.warn(`[Invariant Fail] Debit spread net debit (${netDebitOrCredit}) exceeds or equals strike width (${strikeWidth}). Negative max profit.`);
        return false;
      }
      if (maxProfit <= 0) return false;
    }
  }

  return true;
}

// Evaluate expected payoff & tail risk for a candidate strategy given a terminal price distribution
export function evaluateStrategyPayoff(
  legs: OptionLeg[],
  netDebitPerShare: number,
  terminalPrices: number[]
): { expectedPayoff: number; probabilityOfProfit: number; var95: number; cvar95: number } {
  if (!terminalPrices || terminalPrices.length === 0) {
    return { expectedPayoff: 0, probabilityOfProfit: 50, var95: 0, cvar95: 0 };
  }

  const payoffs: number[] = [];
  let totalPayoff = 0;
  let profitableCount = 0;

  for (const P_terminal of terminalPrices) {
    let payoffPerShare = 0;
    for (const leg of legs) {
      let legValue = 0;
      if (leg.optionType === 'CALL') {
        legValue = Math.max(0, P_terminal - leg.strike);
      } else {
        legValue = Math.max(0, leg.strike - P_terminal);
      }

      if (leg.action === 'BUY') {
        payoffPerShare += legValue;
      } else {
        payoffPerShare -= legValue;
      }
    }

    // Net profit per contract (100 shares) = (Payoff - Net Debit) * 100
    const netProfitPerContract = (payoffPerShare - netDebitPerShare) * 100;
    payoffs.push(netProfitPerContract);
    totalPayoff += netProfitPerContract;

    if (netProfitPerContract > 0) {
      profitableCount++;
    }
  }

  payoffs.sort((a, b) => a - b);
  const idx5Pct = Math.max(0, Math.floor(payoffs.length * 0.05));
  const var95 = payoffs[idx5Pct];
  const tailPayoffs = payoffs.slice(0, Math.max(1, idx5Pct));
  const cvar95 = tailPayoffs.reduce((a, b) => a + b, 0) / tailPayoffs.length;

  const expectedPayoff = totalPayoff / terminalPrices.length;
  const probabilityOfProfit = (profitableCount / terminalPrices.length) * 100;

  return {
    expectedPayoff: Number(expectedPayoff.toFixed(2)),
    probabilityOfProfit: Number(probabilityOfProfit.toFixed(1)),
    var95: Number(var95.toFixed(2)),
    cvar95: Number(cvar95.toFixed(2))
  };
}

// Generate optimized strategy candidates given spot price, IV, terminal price distribution, and forecast usability gate
export function optimizeDerivativesStrategies(
  spotPrice: number,
  annualizedVolDecimal: number,
  dte: number,
  terminalPrices: number[],
  forecastUsable: boolean = true
): OptionStrategyCandidate[] {
  const iv = Math.min(3.0, Math.max(0.05, annualizedVolDecimal));
  const ivDecimal = iv > 1 ? iv / 100 : iv;
  const targetExp = getClosestMonthlyExpiration(dte);
  const T = Math.max(1 / 365, dte / 365);
  const r = 0.05; // Risk-free rate (5%)

  const strikeStep = spotPrice > 300 ? 10 : spotPrice > 100 ? 5 : spotPrice > 50 ? 2.5 : 1;
  const atmStrike = Math.round(spotPrice / strikeStep) * strikeStep;
  const otmCallStrike = atmStrike + strikeStep;
  const otmPutStrike = atmStrike - strikeStep;
  const farOtmPutStrike = otmPutStrike - strikeStep;

  // Helper: compute exact BS price and analytical Greeks for a leg
  function makeLeg(
    action: 'BUY' | 'SELL',
    optionType: 'CALL' | 'PUT',
    strike: number
  ): OptionLeg {
    const isCall = optionType === 'CALL';
    const price = calcBlackScholesPrice(spotPrice, strike, T, r, ivDecimal, isCall);
    const greeks = calcAnalyticalGreeks(spotPrice, strike, T, r, ivDecimal, isCall);
    return {
      action,
      optionType,
      strike,
      expirationDte: dte,
      expirationDate: targetExp.dateString,
      premium: Number(Math.max(0.01, price).toFixed(2)),
      iv: Number(ivDecimal.toFixed(4)),
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      vega: greeks.vega,
    };
  }

  const candidates: OptionStrategyCandidate[] = [];

  // 1. Long Call Strategy
  {
    const leg = makeLeg('BUY', 'CALL', atmStrike);
    const netDebit = leg.premium;
    const maxLoss = netDebit * 100;
    const maxProfit = 99999; // Unlimited
    const breakeven = atmStrike + netDebit;

    const { expectedPayoff, probabilityOfProfit, var95, cvar95 } = evaluateStrategyPayoff([leg], netDebit, terminalPrices);

    const eligibilityLabel = (!forecastUsable || expectedPayoff <= 0) ? 'REJECTED' : expectedPayoff > 50 ? 'PREFERRED' : 'ELIGIBLE';

    candidates.push({
      strategyName: 'Long ATM Call',
      legs: [leg],
      netDebitOrCredit: netDebit,
      maxProfit,
      maxLoss,
      breakevens: [Number(breakeven.toFixed(2))],
      netDelta: leg.delta,
      netGamma: leg.gamma,
      netTheta: leg.theta,
      netVega: leg.vega,
      expectedPayoff,
      probabilityOfProfit,
      returnOnRiskPercent: Number(((expectedPayoff / maxLoss) * 100).toFixed(1)),
      var95,
      cvar95,
      eligibilityLabel,
      invariantVerified: true,
      notes: `Directional long call at $${atmStrike} strike (Exp: ${targetExp.dateString}). Capital risk capped at premium paid ($${maxLoss.toFixed(0)}).`
    });
  }

  // 2. Bull Call Debit Spread
  {
    const longLeg = makeLeg('BUY', 'CALL', atmStrike);
    const shortLeg = makeLeg('SELL', 'CALL', otmCallStrike);

    const netDebit = Number((longLeg.premium - shortLeg.premium).toFixed(2));
    const width = otmCallStrike - atmStrike;
    const maxProfit = Number(((width - netDebit) * 100).toFixed(2));
    const maxLoss = Number((netDebit * 100).toFixed(2));
    const breakeven = Number((atmStrike + netDebit).toFixed(2));

    const { expectedPayoff, probabilityOfProfit, var95, cvar95 } = evaluateStrategyPayoff([longLeg, shortLeg], netDebit, terminalPrices);

    const verified = verifyStrategyInvariants('Call Debit Spread', [longLeg, shortLeg], netDebit, maxProfit, maxLoss, [breakeven], spotPrice);
    const eligibilityLabel = (!forecastUsable || expectedPayoff <= 0 || !verified) ? 'REJECTED' : expectedPayoff > 40 ? 'PREFERRED' : 'ELIGIBLE';

    candidates.push({
      strategyName: 'Call Debit Spread (Bull Vertical)',
      legs: [longLeg, shortLeg],
      netDebitOrCredit: netDebit,
      maxProfit,
      maxLoss,
      breakevens: [breakeven],
      netDelta: longLeg.delta + shortLeg.delta,
      netGamma: longLeg.gamma + shortLeg.gamma,
      netTheta: longLeg.theta + shortLeg.theta,
      netVega: longLeg.vega + shortLeg.vega,
      expectedPayoff,
      probabilityOfProfit,
      returnOnRiskPercent: maxLoss > 0 ? Number(((maxProfit / maxLoss) * 100).toFixed(1)) : 0,
      var95,
      cvar95,
      eligibilityLabel,
      invariantVerified: verified,
      notes: `Defined risk spread buying $${atmStrike} Call and selling $${otmCallStrike} Call (Exp: ${targetExp.dateString}). Max profit = $${maxProfit}.`
    });
  }

  // 3. Bull Put Credit Spread
  {
    const shortLeg = makeLeg('SELL', 'PUT', otmPutStrike);
    const longLeg = makeLeg('BUY', 'PUT', farOtmPutStrike);

    const netCredit = Number((shortLeg.premium - longLeg.premium).toFixed(2));
    const width = otmPutStrike - farOtmPutStrike;
    const maxProfit = Number((netCredit * 100).toFixed(2));
    const maxLoss = Number(((width - netCredit) * 100).toFixed(2));
    const breakeven = Number((otmPutStrike - netCredit).toFixed(2));

    const { expectedPayoff, probabilityOfProfit, var95, cvar95 } = evaluateStrategyPayoff([shortLeg, longLeg], -netCredit, terminalPrices);

    const eligibilityLabel = (!forecastUsable || expectedPayoff <= 0) ? 'REJECTED' : expectedPayoff > 30 ? 'PREFERRED' : 'ELIGIBLE';

    candidates.push({
      strategyName: 'Bull Put Credit Spread',
      legs: [shortLeg, longLeg],
      netDebitOrCredit: -netCredit,
      maxProfit,
      maxLoss,
      breakevens: [breakeven],
      netDelta: shortLeg.delta + longLeg.delta,
      netGamma: shortLeg.gamma + longLeg.gamma,
      netTheta: shortLeg.theta + longLeg.theta,
      netVega: shortLeg.vega + longLeg.vega,
      expectedPayoff,
      probabilityOfProfit,
      returnOnRiskPercent: maxLoss > 0 ? Number(((maxProfit / maxLoss) * 100).toFixed(1)) : 0,
      var95,
      cvar95,
      eligibilityLabel,
      invariantVerified: true,
      notes: `Credit spread collecting $${maxProfit} net credit (Exp: ${targetExp.dateString}). High probability income strategy above $${breakeven}.`
    });
  }

  // Always include NO TRADE (Cash) Benchmark
  const noTradeCandidate: OptionStrategyCandidate = {
    strategyName: 'NO TRADE (Cash)',
    legs: [],
    netDebitOrCredit: 0,
    maxProfit: 0,
    maxLoss: 0,
    breakevens: [],
    netDelta: 0,
    netGamma: 0,
    netTheta: 0,
    netVega: 0,
    expectedPayoff: 0,
    probabilityOfProfit: 100,
    returnOnRiskPercent: 0,
    var95: 0,
    cvar95: 0,
    eligibilityLabel: forecastUsable ? 'NO_TRADE' : 'PREFERRED',
    invariantVerified: true,
    notes: forecastUsable 
      ? 'Benchmark cash position.' 
      : 'PREFERRED ACTION: Forecast failed reliability gate. Capital preserved in cash due to weak BSS or high model disagreement.'
  };

  const validCandidates = candidates.filter(c => c.invariantVerified);
  validCandidates.sort((a, b) => b.expectedPayoff - a.expectedPayoff);

  if (!forecastUsable) {
    return [noTradeCandidate, ...validCandidates];
  } else {
    return [...validCandidates, noTradeCandidate];
  }
}
