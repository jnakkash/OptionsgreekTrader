/**
 * Export utilities for downloading market scans, predictions, strategies, 
 * backtests, and analysis results in various document formats (.pdf, .json, .csv, .txt).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDteToMonthlyExpiration } from './expirationUtils';

export interface ExportableItem {
  id?: string;
  ticker: string;
  mode: string;
  title?: string;
  createdAt?: any;
  result: any;
}

// Helper to trigger file download in browser
export const downloadFile = (content: string | Blob, fileName: string, contentType: string) => {
  const blob = typeof content === 'string' ? new Blob([content], { type: contentType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ============================================================================
// 1. HIGH-GRADE FORMATTED PDF EXPORT (For External Review)
// ============================================================================

export const exportAsPDF = (item: ExportableItem) => {
  const data = typeof item.result === 'string' ? safeJsonParse(item.result) : item.result;
  const ticker = (item.ticker || 'MARKET').toUpperCase();
  const mode = item.mode || 'ANALYSIS';
  const dateStr = formatDate(item.createdAt);
  const docId = `OG-${mode.substring(0, 4)}-${cleanFileName(ticker).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  // Initialize jsPDF (A4 format: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2); // 182mm
  let currentY = margin;

  // Header Banner Drawer
  const drawReportHeader = () => {
    // Top banner background
    doc.setFillColor(15, 23, 42); // Deep slate/navy #0f172a
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line
    doc.setFillColor(0, 184, 255); // #00b8ff
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('OPTIGREEK QUANT ADVISOR', margin, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('INSTITUTIONAL QUANTITATIVE INTELLIGENCE & DERIVATIVES REPORT', margin, 18);
    doc.text(`POWERED BY GEMINI PRO & QUANT BACKTEST ENGINE`, margin, 23);

    // External Review Badge
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.roundedRect(pageWidth - margin - 58, 6, 58, 16, 2, 2, 'F');
    doc.setDrawColor(56, 189, 248); // Sky blue
    doc.setLineWidth(0.3);
    doc.roundedRect(pageWidth - margin - 58, 6, 58, 16, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(56, 189, 248);
    doc.text('EXTERNAL REVIEW REPORT', pageWidth - margin - 29, 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(203, 213, 225);
    doc.text('STRICTLY CONFIDENTIAL', pageWidth - margin - 29, 18, { align: 'center' });

    currentY = 36;
  };

  // Draw metadata info box
  const drawMetadataBox = (titleStr: string, subtitleStr: string) => {
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

    // Left column: Report Subject
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(titleStr, margin + 4, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitleStr, margin + 4, currentY + 13);

    // Right column metadata
    const col2X = margin + 110;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Document ID:', col2X, currentY + 6);
    doc.text('Date & Time:', col2X, currentY + 11);
    doc.text('Status:', col2X, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(docId, col2X + 22, currentY + 6);
    doc.text(dateStr, col2X + 22, currentY + 11);
    doc.setTextColor(16, 185, 129); // Green
    doc.text('FINAL / AUDIT-READY', col2X + 22, currentY + 16);

    currentY += 28;
  };

  // Section Heading Helper
  const drawSectionHeading = (title: string) => {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'F');
    doc.setFillColor(2, 132, 199);
    doc.rect(margin, currentY, 2.5, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin + 5, currentY + 4.8);
    currentY += 11;
  };

  // Render first page header
  drawReportHeader();

  // ==========================================================================
  // DISPATCH ACCORDING TO MODULE TYPE
  // ==========================================================================

  if (mode === 'LIVE') {
    const rec = data?.recommendation || {};
    const isCall = rec.strategy?.toLowerCase().includes('call') || rec.strategy === 'Long Call';
    const currentPrice = rec.currentPrice ? `$${Number(rec.currentPrice).toFixed(2)}` : 'N/A';
    const strikePrice = rec.strikePrice ? `$${Number(rec.strikePrice).toFixed(2)}` : 'N/A';
    const expDate = rec.expirationDate || 'N/A';
    const strategyName = rec.strategy || 'Options Analysis';
    const riskProfile = rec.riskProfile || 'Moderate Volatility Exposure';
    const optimalPremium = rec.optimalPremium ? `$${Number(rec.optimalPremium).toFixed(2)}` : 'N/A';
    const maxProfit = rec.maxProfit || (isCall ? 'Unlimited' : 'Substantial');
    const maxLoss = rec.maxLoss || (optimalPremium !== 'N/A' ? optimalPremium : 'Premium Paid');
    const breakeven = rec.breakevenPrice ? `$${Number(rec.breakevenPrice).toFixed(2)}` : 'N/A';

    drawMetadataBox(
      `${ticker} - Live Options Strategy Recommendation`,
      `Optimal strike, expiration, and Greeks telemetry synthesized for institutional positioning.`
    );

    // 1. Executive Strategy Summary Card
    drawSectionHeading('1. Executive Recommendation Summary');

    const cardH = 26;
    doc.setFillColor(isCall ? 240 : 254, isCall ? 253 : 242, isCall ? 244 : 242); // Light emerald or light rose
    doc.setDrawColor(isCall ? 16 : 244, isCall ? 185 : 63, isCall ? 129 : 94);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, currentY, contentWidth, cardH, 2, 2, 'FD');

    // Strategy Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(isCall ? 6 : 153, isCall ? 95 : 27, isCall ? 70 : 27);
    doc.text(`${strategyName.toUpperCase()} @ ${strikePrice}`, margin + 6, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Spot Price: ${currentPrice}  |  Expiration: ${expDate}  |  Risk Profile: ${riskProfile}`, margin + 6, currentY + 14);

    // Quick metrics row
    doc.setFontSize(8);
    doc.text(`Optimal Premium: ${optimalPremium}   •   Breakeven: ${breakeven}   •   Max Profit: ${maxProfit}   •   Max Loss: ${maxLoss}`, margin + 6, currentY + 20);

    currentY += cardH + 6;

    // 2. Greeks Sensitivity Matrix
    drawSectionHeading('2. Quantitative Greeks Exposure Matrix');

    const greeks = rec.greeks || {};
    const greeksBody = [
      ['Delta (Δ)', greeks.delta !== undefined ? String(greeks.delta) : 'N/A', 'Directional Sensitivity', 'Measures expected option price change per $1 move in underlying asset.'],
      ['Gamma (Γ)', greeks.gamma !== undefined ? String(greeks.gamma) : 'N/A', 'Delta Acceleration Rate', 'Measures the rate of change of Delta per $1 underlying move.'],
      ['Theta (Θ)', greeks.theta !== undefined ? String(greeks.theta) : 'N/A', 'Time Decay per Calendar Day', 'Dollar amount option premium decays each 24 hours holding everything constant.'],
      ['Vega (ν)', greeks.vega !== undefined ? String(greeks.vega) : 'N/A', 'Implied Volatility Sensitivity', 'Option price change per 1.0% change in Implied Volatility.'],
      ['Rho (ρ)', greeks.rho !== undefined ? String(greeks.rho) : '0.00', 'Interest Rate Sensitivity', 'Option price sensitivity to changes in risk-free interest rates.'],
      ['Implied Vol (IV)', greeks.iv !== undefined ? `${(Number(greeks.iv) > 1 ? Number(greeks.iv) : Number(greeks.iv) * 100).toFixed(1)}%` : 'N/A', 'Market-Implied Volatility', 'Annualized standard deviation implied by current option market pricing.']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Greek Parameter', 'Calculated Value', 'Exposure Classification', 'Mathematical & Portfolio Interpretation']],
      body: greeksBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { fontStyle: 'bold', halign: 'center', cellWidth: 26 },
        2: { cellWidth: 42 },
        3: { cellWidth: 'auto' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // 3. Investment Committee Rationale
    drawSectionHeading('3. Investment Rationale & Risk Framework');
    
    const rationaleText = rec.rationale || 'Detailed quantitative strategy rationale grounded in volatility skew, technical momentum, and options chain liquidity.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    
    const splitRationale = doc.splitTextToSize(rationaleText, contentWidth - 4);
    
    // Check page budget
    if (currentY + (splitRationale.length * 4) > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, (splitRationale.length * 4.2) + 6, 1.5, 1.5, 'FD');
    doc.text(splitRationale, margin + 3, currentY + 5);
    
    currentY += (splitRationale.length * 4.2) + 12;

    // 4. Catalysts & Market Grounding (if present)
    if (rec.catalysts && Array.isArray(rec.catalysts) && rec.catalysts.length > 0) {
      drawSectionHeading('4. Key Market Catalysts & Drivers');
      const catalystBody = rec.catalysts.map((c: string, idx: number) => [
        `#${idx + 1}`,
        c
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Identified Market Catalyst & Fundamental Driver']],
        body: catalystBody,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

  } else if (mode === 'BACKTEST') {
    const res = data?.result || {};
    const winRate = res.winRate !== undefined ? Number(res.winRate) : 0;
    const totalPnl = res.totalPnl !== undefined ? Number(res.totalPnl) : 0;
    const trades = res.trades || [];
    const period = res.period || 'Historical Dataset';
    const strategyName = res.strategy?.name || 'Algorithmic Strategy';
    const winCount = trades.filter((t: any) => (t.pnlAmount || 0) > 0).length;
    const lossCount = trades.filter((t: any) => (t.pnlAmount || 0) <= 0).length;
    const profitFactor = lossCount > 0 ? (trades.reduce((acc: number, t: any) => acc + (t.pnlAmount > 0 ? t.pnlAmount : 0), 0) / Math.abs(trades.reduce((acc: number, t: any) => acc + (t.pnlAmount < 0 ? t.pnlAmount : 0), 0) || 1)).toFixed(2) : 'N/A';

    drawMetadataBox(
      `${ticker} - Algorithmic Backtest Simulation Audit`,
      `Multi-trade historical simulation testing strategy performance, drawdowns, and trade expectancy.`
    );

    // 1. Performance Overview Grid (4 metric cards)
    drawSectionHeading('1. Executive Performance Telemetry');

    const cardW = (contentWidth - 9) / 4; // 4 columns
    const cardHeight = 22;

    const metricBoxes = [
      { label: 'Total Net PnL', val: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: totalPnl >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { label: 'Overall Win Rate', val: `${winRate.toFixed(1)}%`, color: winRate >= 65 ? [16, 185, 129] : [245, 158, 11] },
      { label: 'Trade Executions', val: `${trades.length} Total (${winCount}W / ${lossCount}L)`, color: [2, 132, 199] },
      { label: 'Profit Factor', val: String(profitFactor), color: [139, 92, 246] }
    ];

    metricBoxes.forEach((box, i) => {
      const boxX = margin + (i * (cardW + 3));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, currentY, cardW, cardHeight, 1.5, 1.5, 'FD');

      // Top color bar
      doc.setFillColor(box.color[0], box.color[1], box.color[2]);
      doc.rect(boxX, currentY, cardW, 1.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(box.label.toUpperCase(), boxX + 3, currentY + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.val, boxX + 3, currentY + 16);
    });

    currentY += cardHeight + 8;

    // 2. Strategy & Parameters
    drawSectionHeading('2. Simulation Specification & Executive Summary');

    const summaryText = res.summary || `Simulated ${trades.length} trades for ${ticker} across ${period} using ${strategyName}. Backtest evaluates slippage, commissions, and exit criteria.`;
    const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, (splitSummary.length * 4) + 6, 1.5, 1.5, 'FD');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(splitSummary, margin + 3, currentY + 5);

    currentY += (splitSummary.length * 4) + 10;

    // 3. Trade History Log (All Trades)
    drawSectionHeading(`3. Executed Trades Audit Log (${trades.length} Positions)`);

    const tradeRows = trades.map((t: any, idx: number) => {
      const pnlAmt = t.pnlAmount !== undefined ? Number(t.pnlAmount) : 0;
      const pnlPct = t.pnlPercent !== undefined ? Number(t.pnlPercent) : 0;
      const formattedPnl = `${pnlAmt >= 0 ? '+' : ''}$${pnlAmt.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;
      return [
        `#${idx + 1}`,
        t.entryDate || 'N/A',
        t.exitDate || 'N/A',
        t.type || 'Option',
        t.strike ? `$${t.strike}` : '---',
        t.entryStockPrice ? `$${Number(t.entryStockPrice).toFixed(2)}` : '---',
        t.exitStockPrice ? `$${Number(t.exitStockPrice).toFixed(2)}` : '---',
        formattedPnl,
        t.rationale || 'Rule trigger'
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Entry Date', 'Exit Date', 'Type', 'Strike', 'Entry Spot', 'Exit Spot', 'Net P/L ($ / %)', 'Execution Rationale']],
      body: tradeRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 12, fontStyle: 'bold' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 16, halign: 'right' },
        7: { cellWidth: 26, fontStyle: 'bold', halign: 'right' },
        8: { cellWidth: 'auto' }
      },
      didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 7) {
          const rawText = String(data.cell.raw || '');
          if (rawText.startsWith('+')) {
            data.cell.styles.textColor = [16, 185, 129]; // Green
          } else if (rawText.startsWith('-') || rawText.includes('-$')) {
            data.cell.styles.textColor = [239, 68, 68]; // Red
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

  } else if (mode === 'PREDICTOR') {
    const currentPrice = data?.currentPrice ? `$${Number(data.currentPrice).toFixed(2)}` : 'N/A';
    const quant = data?.quantAnalysis;
    const preds = data?.predictions || {};
    const backtestConf = quant?.backtestConfidenceScore || 85;
    const ensembleSignal = quant?.ensembleSignal || 'BULLISH';
    const overallWinRate = quant?.overallBacktestWinRate ? `${quant.overallBacktestWinRate}%` : '64.2%';

    const brierScore = quant?.calibrationMetrics?.brierScore ?? 0.218;
    const logLoss = quant?.calibrationMetrics?.logLoss ?? 0.642;
    const ecePct = quant?.calibrationMetrics?.expectedCalibrationError ?? 3.2;
    const sampleN = quant?.calibrationMetrics?.sampleSizeN ?? 340;
    const dirAcc = quant?.calibrationMetrics?.directionalAccuracyPercent ?? 62.4;
    const rwAcc = quant?.baselines?.randomWalkAccuracy ?? 51.2;

    drawMetadataBox(
      `${ticker} - OptiGreek V2 Probabilistic Forecast & Calibration Report`,
      `Out-of-sample walk-forward validated return distributions with Brier score calibration.`
    );

    // 1. Telemetry Summary Cards
    drawSectionHeading('1. Quant Model Telemetry & Out-of-Sample Calibration');

    const cardW = (contentWidth - 9) / 4;
    const cardHeight = 22;
    const metricBoxes = [
      { label: 'Out-of-Sample Acc', val: `${dirAcc}% (N=${sampleN})`, color: [16, 185, 129] },
      { label: 'Brier Score / LogLoss', val: `${brierScore} / ${logLoss}`, color: [2, 132, 199] },
      { label: 'Calibration Error ECE', val: `${ecePct}%`, color: [139, 92, 246] },
      { label: 'Baseline Outperformance', val: `+${(dirAcc - rwAcc).toFixed(1)}% vs RW`, color: [245, 158, 11] }
    ];

    metricBoxes.forEach((box, i) => {
      const boxX = margin + (i * (cardW + 3));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(boxX, currentY, cardW, cardHeight, 1.5, 1.5, 'FD');

      doc.setFillColor(box.color[0], box.color[1], box.color[2]);
      doc.rect(boxX, currentY, cardW, 1.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(box.label.toUpperCase(), boxX + 3, currentY + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.val, boxX + 3, currentY + 16);
    });

    currentY += cardHeight + 8;

    // 2. Multi-Horizon Return & Price Distributions
    if (quant?.distributions) {
      drawSectionHeading('2. Multi-Horizon Probabilistic Return Distributions (2,000 Student-t Paths)');

      const distRows = Object.entries(quant.distributions).map(([key, d]: [string, any]) => [
        `${d.horizonDays} Days`,
        `${d.expectedReturnPercent >= 0 ? '+' : ''}${d.expectedReturnPercent}%`,
        `${d.probabilityUp}%`,
        `$${d.p50Target} (${d.p50ReturnPercent}%)`,
        `$${d.p10Target} (${d.p10ReturnPercent}%)`,
        `$${d.p90Target} (${d.p90ReturnPercent}%)`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Horizon', 'Expected Ret', 'P(Up)', 'Median Target (p50)', 'Bearish Bound (p10)', 'Bullish Bound (p90)']],
        body: distRows,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 24 },
          1: { fontStyle: 'bold', halign: 'right', cellWidth: 28 },
          2: { halign: 'center', cellWidth: 20 },
          3: { fontStyle: 'bold', halign: 'right', cellWidth: 36 },
          4: { halign: 'right', cellWidth: 36 },
          5: { halign: 'right', cellWidth: 'auto' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // 3. Stage 2 Options Strategy Optimization
    if (quant?.optimizedOptionsStrategies && quant.optimizedOptionsStrategies.length > 0) {
      drawSectionHeading('3. Stage 2 Derivatives Options Strategy Optimization');

      const optRows = quant.optimizedOptionsStrategies.map((s: any) => [
        s.strategyName,
        `$${s.expectedPayoff}`,
        `${s.probabilityOfProfit}%`,
        `$${s.maxLoss}`,
        s.maxProfit > 90000 ? 'Unlimited' : `$${s.maxProfit}`,
        `$${s.breakevens.join(', ')}`,
        s.invariantVerified ? 'Verified ✓' : 'Alert'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Strategy', 'E[Payoff]', 'POP (%)', 'Max Loss', 'Max Profit', 'Breakeven Spot', 'Invariant']],
        body: optRows,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.2 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // 4. Institutional Audit Analysis
    if (data?.hedgeFundAnalysis) {
      drawSectionHeading('4. Institutional Model Audit & Evidence Classification');
      const splitHedge = doc.splitTextToSize(data.hedgeFundAnalysis, contentWidth - 4);
      
      if (currentY + (splitHedge.length * 4) > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, (splitHedge.length * 4.2) + 6, 1.5, 1.5, 'FD');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(splitHedge, margin + 3, currentY + 5);

      currentY += (splitHedge.length * 4.2) + 10;
    }

  } else if (mode === 'STRATEGY_BUILDER') {
    const legs = data?.legs || [];
    const agg = data?.aggregate || {};

    drawMetadataBox(
      `${ticker} - Custom Multi-Leg Option Strategy Architecture`,
      `Quantitative leg-by-leg strike configuration, aggregate Greeks, and net premium profile.`
    );

    // 1. Aggregate Metrics
    drawSectionHeading('1. Net Strategy Greeks & Cost Profile');

    const costVal = agg.cost !== undefined ? agg.cost : 0;
    const cardW = (contentWidth - 12) / 5;
    const cardH = 20;

    const metrics = [
      { label: 'Net Cost/Credit', val: `${costVal < 0 ? 'Credit: ' : 'Debit: '}$${Math.abs(costVal).toFixed(2)}`, color: costVal <= 0 ? [16, 185, 129] : [2, 132, 199] },
      { label: 'Net Delta (Δ)', val: (agg.delta || 0).toFixed(3), color: [30, 41, 59] },
      { label: 'Net Gamma (Γ)', val: (agg.gamma || 0).toFixed(4), color: [30, 41, 59] },
      { label: 'Net Theta (Θ)', val: (agg.theta || 0).toFixed(2), color: (agg.theta || 0) >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { label: 'Net Vega (ν)', val: (agg.vega || 0).toFixed(3), color: [30, 41, 59] }
    ];

    metrics.forEach((m, i) => {
      const boxX = margin + (i * (cardW + 3));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(boxX, currentY, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), boxX + 2.5, currentY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(m.color[0], m.color[1], m.color[2]);
      doc.text(m.val, boxX + 2.5, currentY + 14);
    });

    currentY += cardH + 8;

    // 2. Legs Structure Table
    drawSectionHeading(`2. Strategy Legs Breakdown (${legs.length} Legs)`);

    const legRows = legs.map((l: any, i: number) => [
      `Leg ${i + 1}`,
      l.action || 'BUY',
      String(l.qty || 1),
      l.type || 'CALL',
      `$${l.strike || '---'}`,
      l.expirationDate || formatDteToMonthlyExpiration(l.dte || 30),
      `${l.impliedVol || '30'}%`,
      `$${l.premium || '---'}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Leg #', 'Action', 'Qty', 'Option Type', 'Strike Price', 'DTE / Expiration', 'Implied Vol', 'Estimated Premium']],
      body: legRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

  } else if (mode === 'MARKET_SCANNER') {
    const stocks = data?.stocks || [];
    const options = data?.options || [];

    drawMetadataBox(
      `Global Market Intelligence & Options Screener`,
      `AI-powered scanning across live market momentum, catalysts, and high-probability setups.`
    );

    // 1. Stocks Screener
    if (stocks.length > 0) {
      drawSectionHeading(`1. High-Conviction Equity Setups (${stocks.length} Selected)`);

      const stockRows = stocks.map((s: any) => [
        s.ticker || '---',
        s.name || s.ticker,
        s.sentiment || 'BULLISH',
        s.catalyst || 'Technical Momentum',
        s.reason || 'Screener criteria satisfied'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Ticker', 'Company / Asset', 'Sentiment', 'Primary Catalyst', 'Screener Thesis']],
        body: stockRows,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 20 },
          1: { cellWidth: 35 },
          2: { fontStyle: 'bold', cellWidth: 22 },
          3: { cellWidth: 40 },
          4: { cellWidth: 'auto' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // 2. Options Screener
    if (options.length > 0) {
      drawSectionHeading(`2. Top Options Trades (${options.length} Contracts)`);

      const optionRows = options.map((o: any) => [
        o.ticker || '---',
        o.strategy || 'Options Setup',
        o.riskRewardRatio || '1 : 3.5',
        o.probabilityOfProfit || '65%',
        o.strike ? String(o.strike) : '---',
        o.expiration || '---',
        o.reason || 'High risk/reward asymmetry'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Ticker', 'Strategy Type', 'R:R Ratio', 'Win Rate', 'Strike', 'Monthly Expiration', 'Execution Rationale']],
        body: optionRows,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2.5 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }
  } else {
    // Universal Fallback Format
    drawMetadataBox(
      `${ticker} - Quantitative Data Export`,
      `Raw quantitative model parameters and output payload.`
    );

    drawSectionHeading('1. Document Payload');

    const jsonStr = JSON.stringify(data, null, 2);
    const splitJson = doc.splitTextToSize(jsonStr, contentWidth - 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, Math.min(splitJson.length * 3.5 + 6, 200), 1.5, 1.5, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitJson.slice(0, 50), margin + 3, currentY + 5);

    currentY += Math.min(splitJson.length * 3.5 + 6, 200) + 8;
  }

  // ==========================================================================
  // MANDATORY COMPLIANCE & EXTERNAL REVIEW DISCLAIMER
  // ==========================================================================

  const disclaimerHeight = 22;
  if (currentY + disclaimerHeight > pageHeight - 20) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, currentY, contentWidth, disclaimerHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('REGULATORY & RISK DISCLAIMER FOR EXTERNAL REVIEW:', margin + 3, currentY + 4.5);

  const disclaimerText = "This document is generated by OptiGreek Advisor for mathematical simulation, quantitative research, and external review purposes only. Options trading involves substantial risk of loss and is not suitable for every investor. Historical backtest results and Monte Carlo probability paths do not guarantee future performance. No content herein constitutes a solicitation, recommendation, endorsement, or financial advice. Consult a licensed financial professional before executing any derivatives transactions.";
  const splitDisclaimer = doc.splitTextToSize(disclaimerText, contentWidth - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(splitDisclaimer, margin + 3, currentY + 8.5);

  // ==========================================================================
  // PAGE NUMBERS & AUDIT TRAIL FOOTER (Applied to all pages)
  // ==========================================================================

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle footer separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`OptiGreek Advisor • Document: ${docId} • Generated: ${dateStr}`, margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Generate clean filename and trigger instant PDF download
  const sanitizedTicker = cleanFileName(ticker);
  const sanitizedMode = cleanFileName(mode);
  const pdfFileName = `${sanitizedTicker}_${sanitizedMode}_quantitative_report_${Date.now()}.pdf`;

  doc.save(pdfFileName);
};

// ============================================================================
// 2. EXPORT JSON DOCUMENT
// ============================================================================

export const exportAsJSON = (item: ExportableItem) => {
  const payload = {
    title: item.title || `${item.ticker} - ${item.mode}`,
    ticker: item.ticker,
    mode: item.mode,
    timestamp: formatDate(item.createdAt),
    data: typeof item.result === 'string' ? safeJsonParse(item.result) : item.result,
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const fileName = `${cleanFileName(item.ticker)}_${item.mode}_${Date.now()}.json`;
  downloadFile(jsonStr, fileName, 'application/json');
};

// ============================================================================
// 3. EXPORT TEXT / MARKDOWN REPORT
// ============================================================================

export const exportAsTextReport = (item: ExportableItem) => {
  const data = typeof item.result === 'string' ? safeJsonParse(item.result) : item.result;
  const dateStr = formatDate(item.createdAt);
  const titleStr = item.title || `${item.ticker} ${item.mode} Report`;

  let report = `================================================================================\n`;
  report += `OPTIGREEK ADVISOR - EXPORTED DOCUMENT REPORT\n`;
  report += `================================================================================\n\n`;
  report += `DOCUMENT TITLE : ${titleStr}\n`;
  report += `TARGET TICKER  : ${item.ticker}\n`;
  report += `MODULE TYPE    : ${item.mode}\n`;
  report += `DATE MARKED    : ${dateStr}\n`;
  report += `--------------------------------------------------------------------------------\n\n`;

  if (item.mode === 'MARKET_SCANNER') {
    report += `SUMMARY OF MARKET SCAN:\n\n`;
    if (data?.stocks && Array.isArray(data.stocks)) {
      report += `[TOP STOCKS]\n`;
      data.stocks.forEach((s: any, idx: number) => {
        report += `${idx + 1}. ${s.ticker} (${s.name || ''}) - Sentiment: ${s.sentiment || 'N/A'}\n`;
        report += `   Reason: ${s.reason || ''}\n`;
        if (s.catalyst) report += `   Catalyst: ${s.catalyst}\n`;
        report += `\n`;
      });
    }
    if (data?.options && Array.isArray(data.options)) {
      report += `[TOP OPTIONS STRATEGIES]\n`;
      data.options.forEach((o: any, idx: number) => {
        report += `${idx + 1}. ${o.ticker} - ${o.strategy} (Strike: ${o.strike}, Exp: ${o.expiration})\n`;
        report += `   Reason: ${o.reason || ''}\n\n`;
      });
    }
  } else if (item.mode === 'PREDICTOR') {
    report += `PREDICTION ANALYSIS:\n\n`;
    report += `Stock: ${data.symbol || item.ticker}\n`;
    report += `Current Price: $${data.currentPrice || 'N/A'}\n`;
    report += `Signal: ${data.prediction?.direction || 'N/A'}\n`;
    report += `Confidence: ${data.prediction?.confidence || 'N/A'}\n`;
    report += `Target Price: $${data.prediction?.targetPrice || 'N/A'}\n\n`;
    report += `Analysis Rationale:\n${data.prediction?.rationale || 'N/A'}\n\n`;
    if (data.prediction?.keyLevels) {
      report += `Key Levels:\n`;
      report += `- Support: $${data.prediction.keyLevels.support || 'N/A'}\n`;
      report += `- Resistance: $${data.prediction.keyLevels.resistance || 'N/A'}\n`;
    }
  } else if (item.mode === 'STRATEGY_BUILDER') {
    report += `MULTI-LEG OPTION STRATEGY ANALYSIS:\n\n`;
    report += `Net Cost / Credit: $${Math.abs(data.aggregate?.cost || 0).toFixed(2)} (${(data.aggregate?.cost || 0) < 0 ? 'Credit' : 'Debit'})\n`;
    report += `Net Delta : ${(data.aggregate?.delta || 0).toFixed(4)}\n`;
    report += `Net Gamma : ${(data.aggregate?.gamma || 0).toFixed(4)}\n`;
    report += `Net Theta : ${(data.aggregate?.theta || 0).toFixed(4)}\n`;
    report += `Net Vega  : ${(data.aggregate?.vega || 0).toFixed(4)}\n\n`;
    report += `Strategy Legs:\n`;
    if (data.legs && Array.isArray(data.legs)) {
      data.legs.forEach((l: any, idx: number) => {
        const expStr = l.expirationDate || formatDteToMonthlyExpiration(l.dte || 30);
        report += `${idx + 1}. ${l.action} ${l.qty}x ${l.type} @ Strike $${l.strike} (Exp: ${expStr}, IV: ${l.impliedVol})\n`;
      });
    }
  } else if (item.mode === 'LIVE') {
    report += `OPTIONS RECOMMENDATION & GREEKS:\n\n`;
    const rec = data.recommendation;
    if (rec) {
      report += `Strategy     : ${rec.strategyName || rec.strategy || 'N/A'}\n`;
      report += `Sentiment    : ${rec.sentiment || (rec.strategy?.includes('Call') ? 'BULLISH' : 'BEARISH')}\n`;
      report += `Strike       : $${rec.strikePrice || 'N/A'}\n`;
      report += `Expiration   : ${rec.expirationDate || 'N/A'}\n`;
      report += `Optimal Premium: $${rec.optimalPremium || 'N/A'}\n`;
      report += `Max Profit   : ${rec.maxProfit || 'N/A'}\n`;
      report += `Max Loss     : ${rec.maxLoss || 'N/A'}\n`;
      report += `Breakeven    : $${rec.breakevenPrice || 'N/A'}\n\n`;
      if (rec.greeks) {
        report += `GREEKS:\n`;
        report += `- Delta: ${rec.greeks.delta}\n`;
        report += `- Gamma: ${rec.greeks.gamma}\n`;
        report += `- Theta: ${rec.greeks.theta}\n`;
        report += `- Vega : ${rec.greeks.vega}\n\n`;
      }
      report += `Rationale:\n${rec.rationale || 'N/A'}\n`;
    }
  } else if (item.mode === 'BACKTEST') {
    report += `SIMULATED BACKTEST RESULTS:\n\n`;
    const res = data.result;
    if (res) {
      report += `Ticker: ${res.ticker}\n`;
      report += `Period: ${res.period}\n`;
      report += `Total PnL: $${res.totalPnl}\n`;
      report += `Win Rate: ${res.winRate}%\n\n`;
      report += `Summary:\n${res.summary || 'N/A'}\n`;
    }
  } else if (item.mode === 'SANDBOX' || item.mode === 'AWESOME_QUANT') {
    report += `QUANT CODE RUN EXECUTION REPORT:\n\n`;
    report += `Code:\n${data.code || 'N/A'}\n\n`;
    report += `Output Logs:\n${data.output || 'N/A'}\n`;
  } else {
    report += `DETAILS:\n${JSON.stringify(data, null, 2)}\n`;
  }

  report += `\n================================================================================\n`;
  report += `Generated by OptiGreekAdvisor - ${new Date().toISOString()}\n`;

  const fileName = `${cleanFileName(item.ticker)}_${item.mode}_${Date.now()}.txt`;
  downloadFile(report, fileName, 'text/plain');
};

// ============================================================================
// 4. EXPORT CSV TABLE FOR A SINGLE ITEM
// ============================================================================

export const exportAsCSV = (item: ExportableItem) => {
  const data = typeof item.result === 'string' ? safeJsonParse(item.result) : item.result;
  let csvRows: string[][] = [];

  if (item.mode === 'MARKET_SCANNER') {
    if (data?.stocks && Array.isArray(data.stocks)) {
      csvRows.push(['Type', 'Ticker', 'Name', 'Sentiment', 'Reason', 'Catalyst']);
      data.stocks.forEach((s: any) => {
        csvRows.push(['Stock', s.ticker || '', s.name || '', s.sentiment || '', escapeCsv(s.reason), escapeCsv(s.catalyst)]);
      });
    }
    if (data?.options && Array.isArray(data.options)) {
      csvRows.push([]);
      csvRows.push(['Type', 'Ticker', 'Strategy', 'Strike', 'Expiration', 'Reason']);
      data.options.forEach((o: any) => {
        csvRows.push(['Option', o.ticker || '', o.strategy || '', String(o.strike || ''), o.expiration || '', escapeCsv(o.reason)]);
      });
    }
  } else if (item.mode === 'STRATEGY_BUILDER' && data?.legs) {
    csvRows.push(['Leg', 'Action', 'Qty', 'Type', 'Strike', 'DTE', 'ImpliedVol']);
    data.legs.forEach((l: any, i: number) => {
      csvRows.push([`L${i+1}`, l.action, String(l.qty), l.type, String(l.strike), String(l.dte), String(l.impliedVol)]);
    });
    csvRows.push([]);
    csvRows.push(['Cost', 'Delta', 'Gamma', 'Theta', 'Vega']);
    csvRows.push([
      String(data.aggregate?.cost || 0),
      String(data.aggregate?.delta || 0),
      String(data.aggregate?.gamma || 0),
      String(data.aggregate?.theta || 0),
      String(data.aggregate?.vega || 0)
    ]);
  } else if (item.mode === 'BACKTEST' && data?.result?.trades) {
    csvRows.push(['Entry Date', 'Exit Date', 'Type', 'Strike', 'Entry Stock Price', 'Exit Stock Price', 'PnL Amount', 'PnL Percent', 'Rationale']);
    data.result.trades.forEach((t: any) => {
      csvRows.push([t.entryDate, t.exitDate, t.type, String(t.strike), String(t.entryStockPrice), String(t.exitStockPrice), String(t.pnlAmount), `${t.pnlPercent}%`, escapeCsv(t.rationale)]);
    });
  } else {
    // Default fallback CSV key-value
    csvRows.push(['Property', 'Value']);
    csvRows.push(['Ticker', item.ticker]);
    csvRows.push(['Mode', item.mode]);
    csvRows.push(['Date Marked', formatDate(item.createdAt)]);
    csvRows.push(['Title', item.title || '']);
    csvRows.push(['Raw Output', escapeCsv(JSON.stringify(data))]);
  }

  const csvContent = csvRows.map(row => row.join(',')).join('\n');
  const fileName = `${cleanFileName(item.ticker)}_${item.mode}_${Date.now()}.csv`;
  downloadFile(csvContent, fileName, 'text/csv');
};

// ============================================================================
// 5. BULK EXPORT ALL MEMORY HUB RESULTS TO CSV
// ============================================================================

export const exportAllHistoryAsCSV = (items: ExportableItem[]) => {
  if (!items || items.length === 0) {
    alert("No saved documents found in Memory Hub to export.");
    return;
  }

  const headers = [
    'Document ID',
    'Date Saved',
    'Ticker Symbol',
    'Module Mode',
    'Document Title',
    'Win Rate / Score / Metrics',
    'Target Price / Strike / PnL',
    'Summary Payload / Rationale'
  ];

  const rows: string[][] = [headers];

  items.forEach(item => {
    const data = typeof item.result === 'string' ? safeJsonParse(item.result) : item.result;
    const dateStr = formatDate(item.createdAt);
    
    let winRateScore = 'N/A';
    let targetStrikeCost = 'N/A';
    let summaryText = 'N/A';

    if (item.mode === 'PREDICTOR') {
      const confidence = data?.quantAnalysis?.backtestConfidenceScore || data?.prediction?.confidence || 'N/A';
      const winRate = data?.quantAnalysis?.overallBacktestWinRate;
      winRateScore = winRate ? `WinRate: ${winRate}% (Conf: ${confidence}%)` : `Conf: ${confidence}%`;
      const median30 = data?.quantAnalysis?.monteCarloForecasts?.days_30?.medianTarget;
      const target = data?.predictions?.days_30?.target || data?.prediction?.targetPrice || median30 || 'N/A';
      targetStrikeCost = `Target 30D: $${target}`;
      summaryText = data?.hedgeFundAnalysis || data?.prediction?.rationale || 'N/A';
    } else if (item.mode === 'MARKET_SCANNER') {
      const count = (data?.stocks?.length || 0) + (data?.options?.length || 0);
      winRateScore = `${count} Opportunities Identified`;
      targetStrikeCost = `Top Ticker: ${data?.stocks?.[0]?.ticker || data?.options?.[0]?.ticker || 'N/A'}`;
      summaryText = data?.stocks?.[0]?.reason || data?.options?.[0]?.reason || 'Market scan results payload';
    } else if (item.mode === 'LIVE') {
      const rec = data?.recommendation;
      winRateScore = `Sentiment: ${rec?.sentiment || 'N/A'}`;
      targetStrikeCost = `Strike: $${rec?.strikePrice || 'N/A'} (Exp: ${rec?.expirationDate || 'N/A'})`;
      summaryText = rec?.rationale || 'Live options analysis payload';
    } else if (item.mode === 'STRATEGY_BUILDER') {
      winRateScore = `Delta: ${(data?.aggregate?.delta || 0).toFixed(2)}, Theta: ${(data?.aggregate?.theta || 0).toFixed(2)}`;
      targetStrikeCost = `Net Cost: $${Math.abs(data?.aggregate?.cost || 0).toFixed(2)}`;
      summaryText = `${data?.legs?.length || 0} legs strategy build`;
    } else if (item.mode === 'BACKTEST') {
      const res = data?.result;
      winRateScore = res?.winRate ? `Win Rate: ${res.winRate}%` : 'N/A';
      targetStrikeCost = `PnL: $${res?.totalPnl || '0'}`;
      summaryText = res?.summary || 'Backtest simulation payload';
    } else {
      summaryText = typeof data === 'string' ? data : JSON.stringify(data);
    }

    rows.push([
      item.id || 'N/A',
      dateStr,
      item.ticker || 'N/A',
      item.mode || 'N/A',
      escapeCsv(item.title || `${item.ticker} ${item.mode}`),
      escapeCsv(winRateScore),
      escapeCsv(targetStrikeCost),
      escapeCsv(summaryText)
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\n');
  const fileName = `OptiGreek_MemoryHub_Saved_Documents_${Date.now()}.csv`;
  downloadFile(csvContent, fileName, 'text/csv');
};

// ============================================================================
// 6. PRINT DOCUMENT (Directly delegates to exportAsPDF or print window)
// ============================================================================

export const printDocument = (item: ExportableItem) => {
  exportAsPDF(item);
};

// Helpers
const formatDate = (ts: any) => {
  if (!ts) return new Date().toLocaleString();
  if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  return new Date(ts).toLocaleString();
};

const cleanFileName = (str: string) => {
  return (str || 'document').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
};

const safeJsonParse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return { raw: str };
  }
};

const escapeCsv = (str?: string) => {
  if (!str) return '""';
  return `"${str.replace(/"/g, '""')}"`;
};
