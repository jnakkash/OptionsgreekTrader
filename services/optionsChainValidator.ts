import { getClosestMonthlyExpiration } from './expirationUtils';

export interface RawOptionQuote {
  ticker: string;
  optionType: 'CALL' | 'PUT';
  strike: number;
  expirationDte: number;
  expirationDate?: string;
  bid: number;
  ask: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number; // e.g. 0.25 = 25%
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  quoteTimestamp?: number; // epoch ms
  underlyingTimestamp?: number; // epoch ms
}

export type ValidationRuleType =
  | 'CROSSED_QUOTE'
  | 'NON_POSITIVE_ASK'
  | 'NEGATIVE_BID'
  | 'EXCESSIVE_SPREAD'
  | 'STALE_QUOTE'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'INTRINSIC_LOWER_BOUND_VIOLATION'
  | 'UPPER_BOUND_VIOLATION'
  | 'VERTICAL_MONOTONICITY_VIOLATION'
  | 'VERTICAL_SPREAD_BOUND_VIOLATION'
  | 'BUTTERFLY_CONVEXITY_VIOLATION'
  | 'PUT_CALL_PARITY_ARBITRAGE';

export interface QuoteValidationIssue {
  rule: ValidationRuleType;
  severity: 'ERROR' | 'WARNING';
  message: string;
  details?: Record<string, any>;
}

export interface ValidatedOptionQuote extends RawOptionQuote {
  midPrice: number;
  spreadWidth: number;
  spreadPercent: number;
  isValid: boolean;
  issues: QuoteValidationIssue[];
}

export interface OptionsChainValidationConfig {
  maxSpreadPercent: number; // e.g. 0.30 (30%)
  maxQuoteAgeSeconds: number; // e.g. 300 (5 minutes)
  minVolume: number; // e.g. 0
  minOpenInterest: number; // e.g. 0
  riskFreeRate: number; // e.g. 0.05 (5%)
  parityToleranceDollars: number; // e.g. $0.50
}

export const DEFAULT_CHAIN_VALIDATION_CONFIG: OptionsChainValidationConfig = {
  maxSpreadPercent: 0.30,
  maxQuoteAgeSeconds: 300,
  minVolume: 0,
  minOpenInterest: 0,
  riskFreeRate: 0.05,
  parityToleranceDollars: 0.50
};

export interface ArbitrageOpportunity {
  type: 'VERTICAL_CALL_ARBITRAGE' | 'VERTICAL_PUT_ARBITRAGE' | 'BUTTERFLY_ARBITRAGE' | 'PUT_CALL_PARITY_ARBITRAGE';
  strikes: number[];
  expirationDte: number;
  description: string;
  profitPotentialDollars: number;
}

export interface ChainValidationReport {
  timestamp: string;
  spotPrice: number;
  totalQuotesEvaluated: number;
  validQuotesCount: number;
  rejectedQuotesCount: number;
  arbitrageViolationsCount: number;
  crossedQuotesCount: number;
  staleQuotesCount: number;
  chainIntegrityStatus: 'CLEAN' | 'DEGRADED_QUOTES_REJECTED' | 'INVALID_CHAIN';
  issuesSummary: Array<{ rule: ValidationRuleType; count: number }>;
  validatedQuotes: ValidatedOptionQuote[];
  rejectedQuotes: ValidatedOptionQuote[];
  arbitrageOpportunities: ArbitrageOpportunity[];
}

// Validate single option quote for price bounds, crossed quotes, and liquidity
export function validateSingleQuote(
  quote: RawOptionQuote,
  spotPrice: number,
  config: OptionsChainValidationConfig = DEFAULT_CHAIN_VALIDATION_CONFIG
): ValidatedOptionQuote {
  const issues: QuoteValidationIssue[] = [];
  const { bid, ask, strike, optionType, expirationDte } = quote;

  const midPrice = Number(((bid + ask) / 2).toFixed(2));
  const spreadWidth = Number((ask - bid).toFixed(2));
  const spreadPercent = midPrice > 0 ? Number((spreadWidth / midPrice).toFixed(4)) : 1.0;

  // 1. Crossed Quote Check
  if (bid > ask) {
    issues.push({
      rule: 'CROSSED_QUOTE',
      severity: 'ERROR',
      message: `Crossed quote detected: Bid ($${bid}) > Ask ($${ask}).`,
      details: { bid, ask }
    });
  }

  // 2. Non-positive Ask / Negative Bid Check
  if (ask <= 0) {
    issues.push({
      rule: 'NON_POSITIVE_ASK',
      severity: 'ERROR',
      message: `Invalid ask price: Ask ($${ask}) <= 0.`,
      details: { ask }
    });
  }

  if (bid < 0) {
    issues.push({
      rule: 'NEGATIVE_BID',
      severity: 'ERROR',
      message: `Invalid bid price: Bid ($${bid}) < 0.`,
      details: { bid }
    });
  }

  // 3. Excessive Spread Width
  if (midPrice > 0.10 && spreadPercent > config.maxSpreadPercent) {
    issues.push({
      rule: 'EXCESSIVE_SPREAD',
      severity: 'WARNING',
      message: `Spread width (${(spreadPercent * 100).toFixed(1)}%) exceeds maximum allowed threshold (${(config.maxSpreadPercent * 100).toFixed(0)}%).`,
      details: { spreadPercent, maxSpreadPercent: config.maxSpreadPercent }
    });
  }

  // 4. Stale Quote Check
  if (quote.quoteTimestamp) {
    const quoteAgeSec = (Date.now() - quote.quoteTimestamp) / 1000;
    if (quoteAgeSec > config.maxQuoteAgeSeconds) {
      issues.push({
        rule: 'STALE_QUOTE',
        severity: 'ERROR',
        message: `Quote is stale (${quoteAgeSec.toFixed(0)}s old > ${config.maxQuoteAgeSeconds}s limit).`,
        details: { quoteAgeSec, maxQuoteAgeSeconds: config.maxQuoteAgeSeconds }
      });
    }
  }

  // 5. Intrinsic Lower Bound Violation
  // C >= max(0, S - K * exp(-r*T)), P >= max(0, K * exp(-r*T) - S)
  const T = Math.max(1 / 365, expirationDte / 365);
  const discountFactor = Math.exp(-config.riskFreeRate * T);
  const pvStrike = strike * discountFactor;

  if (optionType === 'CALL') {
    const intrinsicValue = Math.max(0, spotPrice - pvStrike);
    if (midPrice < intrinsicValue - 0.05) {
      issues.push({
        rule: 'INTRINSIC_LOWER_BOUND_VIOLATION',
        severity: 'ERROR',
        message: `Call mid price ($${midPrice}) violates intrinsic lower bound ($${intrinsicValue.toFixed(2)}). Arbitrage condition.`,
        details: { midPrice, intrinsicValue }
      });
    }
    // Upper bound: C <= S
    if (midPrice > spotPrice + 0.05) {
      issues.push({
        rule: 'UPPER_BOUND_VIOLATION',
        severity: 'ERROR',
        message: `Call mid price ($${midPrice}) exceeds spot price ($${spotPrice}). Upper bound violation.`,
        details: { midPrice, spotPrice }
      });
    }
  } else {
    const intrinsicValue = Math.max(0, pvStrike - spotPrice);
    if (midPrice < intrinsicValue - 0.05) {
      issues.push({
        rule: 'INTRINSIC_LOWER_BOUND_VIOLATION',
        severity: 'ERROR',
        message: `Put mid price ($${midPrice}) violates intrinsic lower bound ($${intrinsicValue.toFixed(2)}). Arbitrage condition.`,
        details: { midPrice, intrinsicValue }
      });
    }
    // Upper bound: P <= K
    if (midPrice > strike + 0.05) {
      issues.push({
        rule: 'UPPER_BOUND_VIOLATION',
        severity: 'ERROR',
        message: `Put mid price ($${midPrice}) exceeds strike price ($${strike}). Upper bound violation.`,
        details: { midPrice, strike }
      });
    }
  }

  // 6. Liquidity checks
  if (quote.volume !== undefined && quote.volume < config.minVolume) {
    issues.push({
      rule: 'INSUFFICIENT_LIQUIDITY',
      severity: 'WARNING',
      message: `Volume (${quote.volume}) below required minimum (${config.minVolume}).`,
      details: { volume: quote.volume }
    });
  }

  const isValid = !issues.some(issue => issue.severity === 'ERROR');

  return {
    ...quote,
    midPrice,
    spreadWidth,
    spreadPercent,
    isValid,
    issues
  };
}

// Validate entire options chain including cross-strike vertical monotonicity, spread bounds, and butterfly convexity
export function validateOptionsChain(
  quotes: RawOptionQuote[],
  spotPrice: number,
  customConfig?: Partial<OptionsChainValidationConfig>
): ChainValidationReport {
  const config: OptionsChainValidationConfig = {
    ...DEFAULT_CHAIN_VALIDATION_CONFIG,
    ...customConfig
  };

  const initialValidated = quotes.map(q => validateSingleQuote(q, spotPrice, config));
  const validQuotes = initialValidated.filter(q => q.isValid);
  const rejectedQuotes = initialValidated.filter(q => !q.isValid);

  const arbitrageOpportunities: ArbitrageOpportunity[] = [];
  const issuesSummaryMap = new Map<ValidationRuleType, number>();

  // Count initial issues
  initialValidated.forEach(q => {
    q.issues.forEach(issue => {
      issuesSummaryMap.set(issue.rule, (issuesSummaryMap.get(issue.rule) || 0) + 1);
    });
  });

  // Group valid quotes by expirationDte and optionType for vertical & butterfly arbitrage checks
  const groupedByExpiry = new Map<number, { calls: ValidatedOptionQuote[]; puts: ValidatedOptionQuote[] }>();

  validQuotes.forEach(q => {
    if (!groupedByExpiry.has(q.expirationDte)) {
      groupedByExpiry.set(q.expirationDte, { calls: [], puts: [] });
    }
    const group = groupedByExpiry.get(q.expirationDte)!;
    if (q.optionType === 'CALL') group.calls.push(q);
    else group.puts.push(q);
  });

  groupedByExpiry.forEach(({ calls, puts }, dte) => {
    // Sort calls by strike ascending
    calls.sort((a, b) => a.strike - b.strike);
    // Sort puts by strike ascending
    puts.sort((a, b) => a.strike - b.strike);

    // 1. Call Vertical Monotonicity & Vertical Spread Bounds Check
    // C(K1) >= C(K2) for K1 < K2, and C(K1) - C(K2) <= K2 - K1
    for (let i = 0; i < calls.length - 1; i++) {
      const c1 = calls[i];
      const c2 = calls[i + 1];
      const strikeDiff = c2.strike - c1.strike;

      // Monotonicity: C(K1) < C(K2) means lower strike call is cheaper than higher strike call (arbitrage)
      if (c1.midPrice < c2.midPrice - 0.05) {
        c1.isValid = false;
        c2.isValid = false;
        const msg = `Call vertical monotonicity violation: Call $${c1.strike} ($${c1.midPrice}) < Call $${c2.strike} ($${c2.midPrice}).`;
        c1.issues.push({ rule: 'VERTICAL_MONOTONICITY_VIOLATION', severity: 'ERROR', message: msg });
        c2.issues.push({ rule: 'VERTICAL_MONOTONICITY_VIOLATION', severity: 'ERROR', message: msg });
        issuesSummaryMap.set('VERTICAL_MONOTONICITY_VIOLATION', (issuesSummaryMap.get('VERTICAL_MONOTONICITY_VIOLATION') || 0) + 1);

        arbitrageOpportunities.push({
          type: 'VERTICAL_CALL_ARBITRAGE',
          strikes: [c1.strike, c2.strike],
          expirationDte: dte,
          description: `Buy Call $${c1.strike} @ $${c1.ask}, Sell Call $${c2.strike} @ $${c2.bid}. Free upside leverage.`,
          profitPotentialDollars: Number(((c2.bid - c1.ask) * 100).toFixed(2))
        });
      }

      // Spread bound: C(K1) - C(K2) <= K2 - K1
      const callPriceDiff = c1.midPrice - c2.midPrice;
      if (callPriceDiff > strikeDiff + 0.05) {
        const msg = `Call vertical spread bound violation: C($${c1.strike}) - C($${c2.strike}) = $${callPriceDiff.toFixed(2)} > Strike width ($${strikeDiff}).`;
        c1.issues.push({ rule: 'VERTICAL_SPREAD_BOUND_VIOLATION', severity: 'ERROR', message: msg });
        issuesSummaryMap.set('VERTICAL_SPREAD_BOUND_VIOLATION', (issuesSummaryMap.get('VERTICAL_SPREAD_BOUND_VIOLATION') || 0) + 1);
      }
    }

    // 2. Put Vertical Monotonicity & Vertical Spread Bounds Check
    // P(K1) <= P(K2) for K1 < K2, and P(K2) - P(K1) <= K2 - K1
    for (let i = 0; i < puts.length - 1; i++) {
      const p1 = puts[i];
      const p2 = puts[i + 1];
      const strikeDiff = p2.strike - p1.strike;

      if (p1.midPrice > p2.midPrice + 0.05) {
        p1.isValid = false;
        p2.isValid = false;
        const msg = `Put vertical monotonicity violation: Put $${p1.strike} ($${p1.midPrice}) > Put $${p2.strike} ($${p2.midPrice}).`;
        p1.issues.push({ rule: 'VERTICAL_MONOTONICITY_VIOLATION', severity: 'ERROR', message: msg });
        p2.issues.push({ rule: 'VERTICAL_MONOTONICITY_VIOLATION', severity: 'ERROR', message: msg });
        issuesSummaryMap.set('VERTICAL_MONOTONICITY_VIOLATION', (issuesSummaryMap.get('VERTICAL_MONOTONICITY_VIOLATION') || 0) + 1);

        arbitrageOpportunities.push({
          type: 'VERTICAL_PUT_ARBITRAGE',
          strikes: [p1.strike, p2.strike],
          expirationDte: dte,
          description: `Sell Put $${p1.strike} @ $${p1.bid}, Buy Put $${p2.strike} @ $${p2.ask}. Free downside leverage.`,
          profitPotentialDollars: Number(((p1.bid - p2.ask) * 100).toFixed(2))
        });
      }

      const putPriceDiff = p2.midPrice - p1.midPrice;
      if (putPriceDiff > strikeDiff + 0.05) {
        const msg = `Put vertical spread bound violation: P($${p2.strike}) - P($${p1.strike}) = $${putPriceDiff.toFixed(2)} > Strike width ($${strikeDiff}).`;
        p2.issues.push({ rule: 'VERTICAL_SPREAD_BOUND_VIOLATION', severity: 'ERROR', message: msg });
        issuesSummaryMap.set('VERTICAL_SPREAD_BOUND_VIOLATION', (issuesSummaryMap.get('VERTICAL_SPREAD_BOUND_VIOLATION') || 0) + 1);
      }
    }

    // 3. Butterfly Convexity Check: C(K1) + C(K3) >= 2 * C(K2) for equal strike spacing
    for (let i = 0; i < calls.length - 2; i++) {
      const c1 = calls[i];
      const c2 = calls[i + 1];
      const c3 = calls[i + 2];

      const w1 = c2.strike - c1.strike;
      const w2 = c3.strike - c2.strike;

      if (Math.abs(w1 - w2) < 0.01) {
        // Equal spacing
        const flyCost = c1.midPrice + c3.midPrice - 2 * c2.midPrice;
        if (flyCost < -0.10) {
          // Negative butterfly price implies arbitrage
          const msg = `Call butterfly convexity violation: Butterfly C($${c1.strike}) + C($${c3.strike}) - 2*C($${c2.strike}) = $${flyCost.toFixed(2)} < 0.`;
          c2.issues.push({ rule: 'BUTTERFLY_CONVEXITY_VIOLATION', severity: 'WARNING', message: msg });
          issuesSummaryMap.set('BUTTERFLY_CONVEXITY_VIOLATION', (issuesSummaryMap.get('BUTTERFLY_CONVEXITY_VIOLATION') || 0) + 1);

          arbitrageOpportunities.push({
            type: 'BUTTERFLY_ARBITRAGE',
            strikes: [c1.strike, c2.strike, c3.strike],
            expirationDte: dte,
            description: `Buy 1 Call $${c1.strike}, Buy 1 Call $${c3.strike}, Sell 2 Calls $${c2.strike} for net credit of $${(-flyCost).toFixed(2)}.`,
            profitPotentialDollars: Number((-flyCost * 100).toFixed(2))
          });
        }
      }
    }

    // 4. Put-Call Parity Check for matching strikes
    // C - P = S - K * exp(-r*T)
    const T = Math.max(1 / 365, dte / 365);
    const pvFactor = Math.exp(-config.riskFreeRate * T);

    calls.forEach(c => {
      const matchingPut = puts.find(p => p.strike === c.strike);
      if (matchingPut) {
        const expectedDiff = spotPrice - c.strike * pvFactor;
        const actualDiff = c.midPrice - matchingPut.midPrice;
        const parityDev = actualDiff - expectedDiff;

        if (Math.abs(parityDev) > config.parityToleranceDollars) {
          const msg = `Put-Call Parity deviation: C - P = $${actualDiff.toFixed(2)}, expected $${expectedDiff.toFixed(2)} (Dev: $${parityDev.toFixed(2)}).`;
          c.issues.push({ rule: 'PUT_CALL_PARITY_ARBITRAGE', severity: 'WARNING', message: msg });
          matchingPut.issues.push({ rule: 'PUT_CALL_PARITY_ARBITRAGE', severity: 'WARNING', message: msg });
          issuesSummaryMap.set('PUT_CALL_PARITY_ARBITRAGE', (issuesSummaryMap.get('PUT_CALL_PARITY_ARBITRAGE') || 0) + 1);

          arbitrageOpportunities.push({
            type: 'PUT_CALL_PARITY_ARBITRAGE',
            strikes: [c.strike],
            expirationDte: dte,
            description: parityDev > 0
              ? `Synthetic short: Sell Call $${c.strike}, Buy Put $${c.strike}, Buy Stock @ $${spotPrice.toFixed(2)}. Mispricing $${parityDev.toFixed(2)}.`
              : `Synthetic long: Buy Call $${c.strike}, Sell Put $${c.strike}, Short Stock @ $${spotPrice.toFixed(2)}. Mispricing $${(-parityDev).toFixed(2)}.`,
            profitPotentialDollars: Number((Math.abs(parityDev) * 100).toFixed(2))
          });
        }
      }
    });
  });

  // Re-filter final clean quotes
  const finalValid = initialValidated.filter(q => q.isValid);
  const finalRejected = initialValidated.filter(q => !q.isValid);

  const issuesSummary = Array.from(issuesSummaryMap.entries()).map(([rule, count]) => ({ rule, count }));

  const crossedCount = issuesSummaryMap.get('CROSSED_QUOTE') || 0;
  const staleCount = issuesSummaryMap.get('STALE_QUOTE') || 0;
  const arbCount = (issuesSummaryMap.get('INTRINSIC_LOWER_BOUND_VIOLATION') || 0) +
                    (issuesSummaryMap.get('VERTICAL_MONOTONICITY_VIOLATION') || 0) +
                    (issuesSummaryMap.get('VERTICAL_SPREAD_BOUND_VIOLATION') || 0);

  let chainIntegrityStatus: ChainValidationReport['chainIntegrityStatus'] = 'CLEAN';
  if (finalValid.length < 2 || finalRejected.length > finalValid.length) {
    chainIntegrityStatus = 'INVALID_CHAIN';
  } else if (finalRejected.length > 0 || arbitrageOpportunities.length > 0) {
    chainIntegrityStatus = 'DEGRADED_QUOTES_REJECTED';
  }

  return {
    timestamp: new Date().toISOString(),
    spotPrice,
    totalQuotesEvaluated: quotes.length,
    validQuotesCount: finalValid.length,
    rejectedQuotesCount: finalRejected.length,
    arbitrageViolationsCount: arbCount,
    crossedQuotesCount: crossedCount,
    staleQuotesCount: staleCount,
    chainIntegrityStatus,
    issuesSummary,
    validatedQuotes: finalValid,
    rejectedQuotes: finalRejected,
    arbitrageOpportunities
  };
}

// Generate a synthetic quotes chain for a ticker and validate it
export function buildAndValidateSyntheticChain(
  ticker: string,
  spotPrice: number,
  annualizedVolDecimal: number = 0.25,
  dte: number = 30
): ChainValidationReport {
  const iv = Math.min(3.0, Math.max(0.05, annualizedVolDecimal));
  const approxAtmCall = spotPrice * (0.4 * iv * Math.sqrt(dte / 365));
  const targetExp = getClosestMonthlyExpiration(dte);

  const strikeStep = spotPrice > 300 ? 10 : spotPrice > 100 ? 5 : spotPrice > 50 ? 2.5 : 1;
  const atmStrike = Math.round(spotPrice / strikeStep) * strikeStep;

  const strikes: number[] = [];
  for (let i = -5; i <= 5; i++) {
    strikes.push(atmStrike + i * strikeStep);
  }

  const quotes: RawOptionQuote[] = [];

  strikes.forEach(strike => {
    // Approx Black-Scholes call/put pricing
    const d1 = (Math.log(spotPrice / strike) + (0.05 + 0.5 * iv * iv) * (dte / 365)) / (iv * Math.sqrt(dte / 365));
    const callTheo = Math.max(0.05, approxAtmCall + (spotPrice - strike) * 0.5);
    const putTheo = Math.max(0.05, approxAtmCall + (strike - spotPrice) * 0.5);

    const halfSpread = Math.max(0.05, callTheo * 0.03);

    // Call Quote
    quotes.push({
      ticker: ticker.toUpperCase(),
      optionType: 'CALL',
      strike,
      expirationDte: dte,
      expirationDate: targetExp.dateString,
      bid: Number((callTheo - halfSpread).toFixed(2)),
      ask: Number((callTheo + halfSpread).toFixed(2)),
      lastPrice: Number(callTheo.toFixed(2)),
      volume: 150 + Math.floor(Math.random() * 500),
      openInterest: 1000 + Math.floor(Math.random() * 2000),
      impliedVolatility: Number(iv.toFixed(2)),
      quoteTimestamp: Date.now()
    });

    // Put Quote
    quotes.push({
      ticker: ticker.toUpperCase(),
      optionType: 'PUT',
      strike,
      expirationDte: dte,
      expirationDate: targetExp.dateString,
      bid: Number((putTheo - halfSpread).toFixed(2)),
      ask: Number((putTheo + halfSpread).toFixed(2)),
      lastPrice: Number(putTheo.toFixed(2)),
      volume: 120 + Math.floor(Math.random() * 400),
      openInterest: 800 + Math.floor(Math.random() * 1500),
      impliedVolatility: Number(iv.toFixed(2)),
      quoteTimestamp: Date.now()
    });
  });

  return validateOptionsChain(quotes, spotPrice);
}
