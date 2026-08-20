import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Recommendation, Greeks } from '../types';
import { 
  Activity, Layers, RotateCcw, Eye, Compass, Sliders, Maximize2, 
  Sparkles, TrendingUp, Info, Play, Pause, Download, BarChart2,
  Zap, ChevronRight, HelpCircle
} from 'lucide-react';

interface VolatilitySurfacePlotProps {
  recommendation: Recommendation;
}

interface SurfacePoint {
  strike: number;
  dte: number;
  expDate: string;
  iv: number; // 0.35 = 35%
  moneyness: number; // K / S
  delta?: number;
  isTarget?: boolean;
}

interface ProjectedPoint {
  x2d: number;
  y2d: number;
  zDepth: number;
  raw: SurfacePoint;
  gridX: number;
  gridY: number;
}

interface QuadFacet {
  p0: ProjectedPoint;
  p1: ProjectedPoint;
  p2: ProjectedPoint;
  p3: ProjectedPoint;
  avgDepth: number;
  avgIV: number;
  isTargetFacet: boolean;
}

export const VolatilitySurfacePlot: React.FC<VolatilitySurfacePlotProps> = ({ recommendation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // View mode: '3D_SURFACE' | '2D_SMILES' | 'CONTOUR_HEATMAP'
  const [viewMode, setViewMode] = useState<'3D_SURFACE' | '2D_SMILES' | 'CONTOUR_HEATMAP'>('3D_SURFACE');
  
  // Color palette options
  const [colorPalette, setColorPalette] = useState<'TERMINAL' | 'VIRIDIS' | 'PLASMA' | 'WARM_COOL'>('TERMINAL');

  // 3D Camera Angles & Rotation State
  const [yaw, setYaw] = useState<number>(35); // Horizontal rotation in degrees (-180 to 180)
  const [pitch, setPitch] = useState<number>(28); // Vertical tilt in degrees (5 to 85)
  const [zoom, setZoom] = useState<number>(1.0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({ x: 0, y: 0, yaw: 35, pitch: 28 });

  // Interactive Quantitative Adjustment Sliders
  const [baseATMIV, setBaseATMIV] = useState<number>(() => {
    return recommendation.greeks?.iv ? Math.round(recommendation.greeks.iv * 100) : 32;
  });
  const [skewFactor, setSkewFactor] = useState<number>(1.2); // Skew steepness multiplier (0.5 to 2.5)
  const [termStructureSlope, setTermStructureSlope] = useState<number>(0.0); // -1.0 (Backwardation) to +1.0 (Contango)
  const [showWireframeOnly, setShowWireframeOnly] = useState<boolean>(false);
  const [showTargetBeacon, setShowTargetBeacon] = useState<boolean>(true);

  // Hovered Point for Tooltip
  const [hoveredPoint, setHoveredPoint] = useState<SurfacePoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Selected DTE for 2D Smile slice focus
  const [selectedDTEFilter, setSelectedDTEFilter] = useState<number | null>(null);

  const spotPrice = recommendation.currentPrice || 100;
  const targetStrike = recommendation.strikePrice || spotPrice;

  // Derive standard expiration grid dates (from 7 DTE to 360 DTE)
  const expirations = useMemo(() => [
    { dte: 14, label: '14D (Near)', date: '2 Wks' },
    { dte: 30, label: '30D (1 Mo)', date: '1 Month' },
    { dte: 60, label: '60D (2 Mo)', date: '2 Months' },
    { dte: 90, label: '90D (Quarterly)', date: '3 Months' },
    { dte: 180, label: '180D (Semi-Annual)', date: '6 Months' },
    { dte: 270, label: '270D (9 Mo)', date: '9 Months' },
    { dte: 360, label: '360D (1 Yr LEAPS)', date: '1 Year' },
  ], []);

  // Strikes grid from 70% of spot to 130% of spot (13 discrete strikes)
  const strikes = useMemo(() => {
    const minMoneyness = 0.70;
    const maxMoneyness = 1.30;
    const count = 15;
    const list: number[] = [];
    const step = (maxMoneyness - minMoneyness) / (count - 1);
    for (let i = 0; i < count; i++) {
      const m = minMoneyness + i * step;
      const rawStrike = spotPrice * m;
      // Round to nice strike step based on price magnitude
      const rounded = spotPrice > 500 ? Math.round(rawStrike / 10) * 10 :
                      spotPrice > 100 ? Math.round(rawStrike / 5) * 5 :
                      spotPrice > 30 ? Math.round(rawStrike / 2.5) * 2.5 :
                      Math.round(rawStrike);
      if (!list.includes(rounded)) list.push(rounded);
    }
    // Ensure target strike is in list
    if (!list.includes(targetStrike)) {
      list.push(targetStrike);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [spotPrice, targetStrike]);

  // Synthetic SVI / Parametric Volatility Surface Model Generator
  // Calculates implied volatility sigma(K, T) based on Moneyness, Skew, and Term Structure
  const surfaceMatrix: SurfacePoint[][] = useMemo(() => {
    const baseSigma = baseATMIV / 100;

    return expirations.map((exp) => {
      const T = exp.dte / 365;
      
      // Term structure effect: Contango (+slope) increases long-dated IV; Backwardation (-slope) spikes short-dated IV
      const termAdjustment = termStructureSlope * 0.08 * (Math.log(T + 0.1) + 0.5);
      const atmIVForT = Math.max(0.10, baseSigma + termAdjustment);

      return strikes.map((strike) => {
        const moneyness = strike / spotPrice; // K / S
        const logMoneyness = Math.log(moneyness); // ln(K / S)

        // Skew & Smile formula (Parametric quadratic skew with SVI-like tail curvature)
        // Downside puts (logMoneyness < 0) have higher skew steepness (Crash-o-phobia)
        const asymmetry = logMoneyness < 0 ? 1.8 * skewFactor : 0.8 * skewFactor;
        const skewComponent = -0.22 * asymmetry * (logMoneyness / Math.sqrt(T + 0.15));
        const smileComponent = 0.45 * skewFactor * (Math.pow(logMoneyness, 2) / (T + 0.2));

        let computedIV = atmIVForT + skewComponent + smileComponent;
        computedIV = Math.max(0.08, Math.min(1.80, computedIV)); // clamp between 8% and 180%

        // Approximate Black-Scholes Delta for contextual tooltip
        const d1 = (Math.log(spotPrice / strike) + (0.045 + 0.5 * Math.pow(computedIV, 2)) * T) / (computedIV * Math.sqrt(T));
        const approxDelta = Math.max(0.01, Math.min(0.99, 0.5 + 0.5 * Math.sin(Math.max(-1.5, Math.min(1.5, d1)))));

        const isTarget = Math.abs(strike - targetStrike) < 1.0;

        return {
          strike,
          dte: exp.dte,
          expDate: exp.label,
          iv: computedIV,
          moneyness: Number(moneyness.toFixed(3)),
          delta: Number(approxDelta.toFixed(2)),
          isTarget
        };
      });
    });
  }, [expirations, strikes, spotPrice, baseATMIV, skewFactor, termStructureSlope, targetStrike]);

  // Color Scale Generator based on chosen palette
  const ivMin = useMemo(() => {
    let min = 1.0;
    surfaceMatrix.forEach(row => row.forEach(p => { if (p.iv < min) min = p.iv; }));
    return min;
  }, [surfaceMatrix]);

  const ivMax = useMemo(() => {
    let max = 0.0;
    surfaceMatrix.forEach(row => row.forEach(p => { if (p.iv > max) max = p.iv; }));
    return max;
  }, [surfaceMatrix]);

  const getColorForIV = (iv: number): string => {
    const t = Math.max(0, Math.min(1, (iv - ivMin) / (ivMax - ivMin || 0.01)));
    if (colorPalette === 'VIRIDIS') {
      return d3.interpolateViridis(t);
    }
    if (colorPalette === 'PLASMA') {
      return d3.interpolatePlasma(t);
    }
    if (colorPalette === 'WARM_COOL') {
      return d3.interpolateRdYlBu(1 - t);
    }
    // 'TERMINAL' Neon Cyan -> Emerald -> Amber -> Crimson
    const colors = ['#00e5ff', '#00e676', '#ffeb3b', '#ff9100', '#ff1744'];
    const scale = d3.scaleLinear<string>().domain([0, 0.25, 0.5, 0.75, 1.0]).range(colors);
    return scale(t);
  };

  // Auto-rotation loop
  useEffect(() => {
    let animationFrameId: number;
    if (isAutoRotating && viewMode === '3D_SURFACE') {
      const step = () => {
        setYaw(prev => (prev + 0.35) % 360);
        animationFrameId = requestAnimationFrame(step);
      };
      animationFrameId = requestAnimationFrame(step);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isAutoRotating, viewMode]);

  // 3D Projection Engine (Isometric / Perspective Matrix Transformation)
  const { projectedFacets, projectedAxes, targetProjected } = useMemo(() => {
    const width = 800;
    const height = 480;
    const originX = width / 2;
    const originY = height / 2 + 30;

    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    const cosY = Math.cos(radYaw);
    const sinY = Math.sin(radYaw);
    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);

    // Bounding Box Normalization [-1, 1]
    const minStrike = strikes[0];
    const maxStrike = strikes[strikes.length - 1];
    const minDte = expirations[0].dte;
    const maxDte = expirations[expirations.length - 1].dte;

    const project3D = (strike: number, dte: number, iv: number): { x2d: number; y2d: number; zDepth: number } => {
      // Normalized coordinates in range [-1.2, 1.2]
      const nx = ((strike - minStrike) / (maxStrike - minStrike) - 0.5) * 2.4;
      const ny = ((dte - minDte) / (maxDte - minDte) - 0.5) * 2.4;
      const nz = ((iv - ivMin) / (ivMax - ivMin || 1) - 0.5) * 1.8;

      // 3D Rotation (Yaw around Z, then Pitch around X)
      // Step 1: Rotate Yaw
      const rx = nx * cosY - ny * sinY;
      const ry = nx * sinY + ny * cosY;
      const rz = nz;

      // Step 2: Rotate Pitch
      const px = rx;
      const py = ry * cosP - rz * sinP;
      const pz = ry * sinP + rz * cosP;

      // Perspective Projection
      const cameraDistance = 4.5 / zoom;
      const perspective = cameraDistance / (cameraDistance - py);

      const scale = 140 * zoom * perspective;
      const x2d = originX + px * scale;
      const y2d = originY - pz * scale;
      const zDepth = py; // For painter's algorithm depth sorting

      return { x2d, y2d, zDepth };
    };

    // Project all grid points
    const grid: ProjectedPoint[][] = surfaceMatrix.map((row, rIdx) => {
      return row.map((pt, cIdx) => {
        const { x2d, y2d, zDepth } = project3D(pt.strike, pt.dte, pt.iv);
        return {
          x2d,
          y2d,
          zDepth,
          raw: pt,
          gridX: cIdx,
          gridY: rIdx
        };
      });
    });

    // Build Quad Polygons with Painter's Algorithm Depth Sorting
    const facets: QuadFacet[] = [];
    for (let r = 0; r < grid.length - 1; r++) {
      for (let c = 0; c < grid[r].length - 1; c++) {
        const p00 = grid[r][c];
        const p10 = grid[r + 1][c];
        const p11 = grid[r + 1][c + 1];
        const p01 = grid[r][c + 1];

        const avgDepth = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
        const avgIV = (p00.raw.iv + p10.raw.iv + p11.raw.iv + p01.raw.iv) / 4;
        const isTargetFacet = p00.raw.isTarget || p10.raw.isTarget || p11.raw.isTarget || p01.raw.isTarget;

        facets.push({
          p0: p00,
          p1: p10,
          p2: p11,
          p3: p01,
          avgDepth,
          avgIV,
          isTargetFacet: !!isTargetFacet
        });
      }
    }

    // Sort from back to front (Painter's algorithm: lowest depth first)
    facets.sort((a, b) => a.avgDepth - b.avgDepth);

    // Project 3D Axis lines and bounding box floor
    const originAxis = project3D(minStrike, minDte, ivMin);
    const strikeAxisEnd = project3D(maxStrike, minDte, ivMin);
    const dteAxisEnd = project3D(minStrike, maxDte, ivMin);
    const ivAxisEnd = project3D(minStrike, minDte, ivMax);

    // Find Target Projected Point
    let targetPt: ProjectedPoint | null = null;
    grid.forEach(row => {
      row.forEach(p => {
        if (p.raw.isTarget) targetPt = p;
      });
    });

    return {
      projectedFacets: facets,
      projectedAxes: {
        origin: originAxis,
        strikeEnd: strikeAxisEnd,
        dteEnd: dteAxisEnd,
        ivEnd: ivAxisEnd
      },
      targetProjected: targetPt
    };
  }, [yaw, pitch, zoom, surfaceMatrix, strikes, expirations, ivMin, ivMax]);

  // Mouse Drag Handlers for 3D Camera Rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw,
      pitch
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    setYaw((dragStartRef.current.yaw + dx * 0.6 + 360) % 360);
    setPitch(Math.max(5, Math.min(85, dragStartRef.current.pitch - dy * 0.4)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset Camera View
  const handleResetCamera = () => {
    setYaw(35);
    setPitch(28);
    setZoom(1.0);
    setIsAutoRotating(false);
  };

  return (
    <div className="w-full bg-[#0a0b0d] border border-gray-800/90 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in">
      
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <Activity size={12} /> D3 Volatility Surface Matrix
            </span>
            <span className="text-xs text-gray-500 font-mono">
              σ(K, T) Term Structure & Smile Dynamics
            </span>
          </div>

          <h3 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Layers className="text-cyan-400" size={24} /> Implied Volatility Surface & Smile Engine
          </h3>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
            Continuous parametric representation of <strong>Implied Volatility (IV)</strong> across strike moneyness ($K/S$) and expiration horizons ($T$). Inspect OTM put skew, ATM term structure, and volatility smile curvatures.
          </p>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex items-center gap-2 bg-[#121418] p-1 rounded-xl border border-gray-800 flex-wrap">
          <button
            onClick={() => setViewMode('3D_SURFACE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              viewMode === '3D_SURFACE'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass size={13} /> 3D Surface Mesh
          </button>

          <button
            onClick={() => setViewMode('2D_SMILES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              viewMode === '2D_SMILES'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={13} /> 2D Smile Slices
          </button>

          <button
            onClick={() => setViewMode('CONTOUR_HEATMAP')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'CONTOUR_HEATMAP'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart2 size={13} /> Matrix Heatmap
          </button>
        </div>
      </div>

      {/* Quantitative Parameter Tuning Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#0e1014] p-4 rounded-xl border border-gray-800/80">
        
        {/* Base ATM IV Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1">
              <Activity size={12} className="text-cyan-400" /> Base ATM IV ($\sigma_0$)
            </span>
            <span className="text-cyan-300 font-bold">{baseATMIV}%</span>
          </div>
          <input 
            type="range"
            min="10"
            max="120"
            value={baseATMIV}
            onChange={(e) => setBaseATMIV(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-gray-600 font-mono">
            <span>10% (Low Vol)</span>
            <span>120% (High Vol)</span>
          </div>
        </div>

        {/* Skew Steepness Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-400" /> Put Skew Steepness
            </span>
            <span className="text-emerald-300 font-bold">{skewFactor.toFixed(1)}x</span>
          </div>
          <input 
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={skewFactor}
            onChange={(e) => setSkewFactor(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex justify-between text-[10px] text-gray-600 font-mono">
            <span>0.5x (Flat Skew)</span>
            <span>2.5x (Steep Crash Skew)</span>
          </div>
        </div>

        {/* Term Structure Slope Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1">
              <Sliders size={12} className="text-purple-400" /> Term Structure Slope
            </span>
            <span className="text-purple-300 font-bold">
              {termStructureSlope > 0.1 ? 'Contango (+)' : termStructureSlope < -0.1 ? 'Backwardation (-)' : 'Flat (0)'}
            </span>
          </div>
          <input 
            type="range"
            min="-1.0"
            max="1.0"
            step="0.1"
            value={termStructureSlope}
            onChange={(e) => setTermStructureSlope(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
          <div className="flex justify-between text-[10px] text-gray-600 font-mono">
            <span>Backwardation (Inverted)</span>
            <span>Contango (Normal)</span>
          </div>
        </div>

        {/* Color Palette & Visual Mode */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" /> Color Shading
            </span>
            <span className="text-amber-300 font-bold">{colorPalette}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'TERMINAL', label: 'Neon' },
              { id: 'VIRIDIS', label: 'Viridis' },
              { id: 'PLASMA', label: 'Plasma' },
              { id: 'WARM_COOL', label: 'RdYlBu' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setColorPalette(p.id as any)}
                className={`text-[10px] font-mono py-1 rounded border transition-all ${
                  colorPalette === p.id 
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-bold'
                    : 'bg-black/40 text-gray-400 border-gray-800 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono pt-0.5">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={showWireframeOnly}
                onChange={(e) => setShowWireframeOnly(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-cyan-400 focus:ring-0"
              />
              <span>Wireframe</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={showTargetBeacon}
                onChange={(e) => setShowTargetBeacon(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-cyan-400 focus:ring-0"
              />
              <span>Target Pin</span>
            </label>
          </div>
        </div>
      </div>

      {/* VIEW 1: 3D VOLATILITY SURFACE PLOT */}
      {viewMode === '3D_SURFACE' && (
        <div className="relative bg-[#07080a] border border-gray-800/80 rounded-2xl overflow-hidden shadow-inner">
          
          {/* 3D Camera Controls Floating HUD */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-gray-800">
            <button
              onClick={() => setIsAutoRotating(prev => !prev)}
              className={`p-2 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                isAutoRotating ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title={isAutoRotating ? "Pause Auto-Rotation" : "Start Auto-Rotation"}
            >
              {isAutoRotating ? <Pause size={14} /> : <Play size={14} />}
              <span className="hidden sm:inline">{isAutoRotating ? 'Rotating' : 'Auto Rotate'}</span>
            </button>

            <button
              onClick={() => setZoom(prev => Math.min(1.8, prev + 0.15))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-xs font-mono"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-xs font-mono"
              title="Zoom Out"
            >
              -
            </button>

            <button
              onClick={handleResetCamera}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-xs font-mono flex items-center gap-1"
              title="Reset 3D Camera"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Interactive Drag Hint Overlay */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-800 text-[11px] font-mono text-gray-400 flex items-center gap-2">
            <Compass size={13} className="text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>Click & Drag to Rotate Surface • Yaw: {Math.round(yaw)}° • Pitch: {Math.round(pitch)}°</span>
          </div>

          {/* Target Strike Beacon Legend */}
          {targetProjected && showTargetBeacon && (
            <div className="absolute bottom-4 left-4 z-20 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-cyan-500/40 text-xs font-mono text-cyan-300 flex items-center gap-2.5 shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <div>
                <span className="font-bold text-white">Recommended Target Strike:</span> ${recommendation.strikePrice} 
                <span className="text-gray-400 ml-1.5">({recommendation.expirationDate})</span>
              </div>
            </div>
          )}

          {/* SVG 3D Canvas */}
          <div 
            ref={containerRef}
            className="w-full h-[520px] cursor-grab active:cursor-grabbing select-none relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg 
              ref={svgRef}
              className="w-full h-full"
              viewBox="0 0 800 480"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient id="targetGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="gridFloorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* 3D Wireframe / Shaded Surface Mesh Polygons */}
              <g className="surface-facets">
                {projectedFacets.map((facet, idx) => {
                  const pathData = `M ${facet.p0.x2d} ${facet.p0.y2d} L ${facet.p1.x2d} ${facet.p1.y2d} L ${facet.p2.x2d} ${facet.p2.y2d} L ${facet.p3.x2d} ${facet.p3.y2d} Z`;
                  const fillColor = getColorForIV(facet.avgIV);
                  const isHovered = hoveredPoint && (
                    facet.p0.raw === hoveredPoint || 
                    facet.p1.raw === hoveredPoint || 
                    facet.p2.raw === hoveredPoint || 
                    facet.p3.raw === hoveredPoint
                  );

                  return (
                    <path
                      key={idx}
                      d={pathData}
                      fill={showWireframeOnly ? 'none' : fillColor}
                      fillOpacity={showWireframeOnly ? 0 : isHovered ? 0.95 : 0.72}
                      stroke={isHovered ? '#ffffff' : showWireframeOnly ? fillColor : '#000000'}
                      strokeWidth={isHovered ? 1.5 : showWireframeOnly ? 1.2 : 0.6}
                      strokeOpacity={showWireframeOnly ? 0.85 : 0.4}
                      className="transition-opacity duration-150"
                    />
                  );
                })}
              </g>

              {/* Interactive Surface Nodes (Hover Points) */}
              <g className="surface-nodes">
                {surfaceMatrix.map((row, r) => 
                  row.map((pt, c) => {
                    const minStrike = strikes[0];
                    const maxStrike = strikes[strikes.length - 1];
                    const minDte = expirations[0].dte;
                    const maxDte = expirations[expirations.length - 1].dte;

                    // Compute projected point on the fly
                    const nx = ((pt.strike - minStrike) / (maxStrike - minStrike) - 0.5) * 2.4;
                    const ny = ((pt.dte - minDte) / (maxDte - minDte) - 0.5) * 2.4;
                    const nz = ((pt.iv - ivMin) / (ivMax - ivMin || 1) - 0.5) * 1.8;

                    const radYaw = (yaw * Math.PI) / 180;
                    const radPitch = (pitch * Math.PI) / 180;
                    const rx = nx * Math.cos(radYaw) - ny * Math.sin(radYaw);
                    const ry = nx * Math.sin(radYaw) + ny * Math.cos(radYaw);
                    const px = rx;
                    const py = ry * Math.cos(radPitch) - nz * Math.sin(radPitch);
                    const pz = ry * Math.sin(radPitch) + nz * Math.cos(radPitch);

                    const cameraDist = 4.5 / zoom;
                    const perspective = cameraDist / (cameraDist - py);
                    const scale = 140 * zoom * perspective;
                    const x = 400 + px * scale;
                    const y = 270 - pz * scale;

                    const isTarget = pt.isTarget;
                    const isHovered = hoveredPoint === pt;

                    return (
                      <g key={`${r}_${c}`}>
                        {/* Hover Hit Target */}
                        <circle
                          cx={x}
                          cy={y}
                          r={isTarget ? 7 : isHovered ? 6 : 3.5}
                          fill={isTarget ? '#00e5ff' : isHovered ? '#ffffff' : getColorForIV(pt.iv)}
                          stroke={isTarget ? '#ffffff' : '#000000'}
                          strokeWidth={isTarget ? 2 : 1}
                          className="cursor-pointer transition-all duration-100 hover:scale-150"
                          onMouseEnter={(e) => {
                            setHoveredPoint(pt);
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltipPos({
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredPoint(null);
                            setTooltipPos(null);
                          }}
                        />

                        {/* Pulsing Beacon Ring for Target Strike */}
                        {isTarget && showTargetBeacon && (
                          <g>
                            <circle
                              cx={x}
                              cy={y}
                              r={14}
                              fill="none"
                              stroke="#00e5ff"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                              className="animate-spin"
                              style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '6s' }}
                            />
                            <line 
                              x1={x} 
                              y1={y} 
                              x2={x} 
                              y2={y - 30} 
                              stroke="#00e5ff" 
                              strokeWidth={1.5} 
                              strokeDasharray="2 2"
                            />
                            <circle cx={x} cy={y - 30} r={3} fill="#00e5ff" />
                            <text
                              x={x + 6}
                              y={y - 26}
                              fill="#00e5ff"
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              TARGET: ${pt.strike}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })
                )}
              </g>
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredPoint && tooltipPos && (
              <div 
                className="absolute z-30 pointer-events-none bg-black/90 backdrop-blur-md border border-gray-700 p-3.5 rounded-xl shadow-2xl text-xs font-mono text-white space-y-1.5 min-w-[200px]"
                style={{
                  left: Math.min(600, Math.max(10, tooltipPos.x + 15)),
                  top: Math.min(380, Math.max(10, tooltipPos.y - 40))
                }}
              >
                <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                  <span className="font-bold text-cyan-400">${hoveredPoint.strike} Strike</span>
                  <span className="text-[10px] text-gray-400">{hoveredPoint.expDate}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Implied Vol</span>
                    <span className="font-bold text-emerald-400">{(hoveredPoint.iv * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Moneyness</span>
                    <span className={`font-bold ${hoveredPoint.moneyness < 1 ? 'text-rose-400' : 'text-sky-400'}`}>
                      {(hoveredPoint.moneyness * 100).toFixed(1)}% ({hoveredPoint.moneyness < 1 ? 'OTM Put' : 'OTM Call'})
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">DTE</span>
                    <span className="font-bold text-gray-200">{hoveredPoint.dte} Days</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[9px] uppercase">Approx Delta</span>
                    <span className="font-bold text-amber-400">Δ {hoveredPoint.delta}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: 2D VOLATILITY SMILE CROSS-SECTIONS */}
      {viewMode === '2D_SMILES' && (
        <div className="bg-[#07080a] border border-gray-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-cyan-400" /> Multi-Term Volatility Smile Cross-Sections
              </h4>
              <p className="text-xs text-gray-400">
                Superimposed IV smile curves $\sigma(K)$ highlighting put skew steepness across expiration maturities.
              </p>
            </div>

            {/* DTE Term Selector Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedDTEFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  selectedDTEFilter === null ? 'bg-cyan-500 text-black font-bold' : 'bg-black/60 text-gray-400 border border-gray-800'
                }`}
              >
                All Terms
              </button>
              {expirations.map(exp => (
                <button
                  key={exp.dte}
                  onClick={() => setSelectedDTEFilter(exp.dte === selectedDTEFilter ? null : exp.dte)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    selectedDTEFilter === exp.dte ? 'bg-cyan-500 text-black font-bold' : 'bg-black/60 text-gray-400 border border-gray-800'
                  }`}
                >
                  {exp.label}
                </button>
              ))}
            </div>
          </div>

          {/* D3 2D Multi-Line Chart */}
          <div className="w-full h-[400px] relative">
            <svg className="w-full h-full" viewBox="0 0 760 360" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="strikeAtmArea" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines & Axes */}
              <g className="grid-lines" opacity="0.15">
                {[0, 1, 2, 3, 4].map(i => {
                  const y = 30 + i * 65;
                  return (
                    <line key={i} x1="60" y1={y} x2="720" y2={y} stroke="#ffffff" strokeDasharray="3 3" />
                  );
                })}
              </g>

              {/* ATM Spot Reference Line */}
              {(() => {
                const minS = strikes[0];
                const maxS = strikes[strikes.length - 1];
                const atmX = 60 + ((spotPrice - minS) / (maxS - minS)) * 660;
                return (
                  <g>
                    <line x1={atmX} y1="30" x2={atmX} y2="300" stroke="#ffeb3b" strokeWidth="1.5" strokeDasharray="4 4" />
                    <text x={atmX + 4} y="45" fill="#ffeb3b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      SPOT: ${spotPrice}
                    </text>
                  </g>
                );
              })()}

              {/* Target Strike Reference Line */}
              {(() => {
                const minS = strikes[0];
                const maxS = strikes[strikes.length - 1];
                const tgtX = 60 + ((targetStrike - minS) / (maxS - minS)) * 660;
                return (
                  <g>
                    <line x1={tgtX} y1="30" x2={tgtX} y2="300" stroke="#00e5ff" strokeWidth="2" />
                    <rect x={tgtX - 40} y="15" width="80" height="18" rx="4" fill="#00e5ff" />
                    <text x={tgtX} y="27" fill="#000000" fontSize="9" fontFamily="monospace" fontWeight="black" textAnchor="middle">
                      TARGET ${targetStrike}
                    </text>
                  </g>
                );
              })()}

              {/* D3 Smile Curves per Expiration */}
              {surfaceMatrix.map((row, rIdx) => {
                const exp = expirations[rIdx];
                if (selectedDTEFilter !== null && exp.dte !== selectedDTEFilter) return null;

                const minS = strikes[0];
                const maxS = strikes[strikes.length - 1];
                const scaleX = (s: number) => 60 + ((s - minS) / (maxS - minS)) * 660;
                const scaleY = (iv: number) => 300 - ((iv - ivMin) / (ivMax - ivMin || 1)) * 260;

                const lineGenerator = d3.line<SurfacePoint>()
                  .x(d => scaleX(d.strike))
                  .y(d => scaleY(d.iv))
                  .curve(d3.curveMonotoneX);

                const pathString = lineGenerator(row) || '';
                const strokeColor = getColorForIV(row[Math.floor(row.length / 2)].iv);

                return (
                  <g key={rIdx} className="smile-curve group">
                    <path
                      d={pathString}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={selectedDTEFilter === exp.dte ? 3.5 : 2}
                      strokeOpacity={selectedDTEFilter === null ? 0.85 : 1.0}
                      className="transition-all duration-200"
                    />

                    {/* Nodes along curve */}
                    {row.map((pt, cIdx) => {
                      const cx = scaleX(pt.strike);
                      const cy = scaleY(pt.iv);
                      const isHovered = hoveredPoint === pt;

                      return (
                        <circle
                          key={cIdx}
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 6 : 3}
                          fill={isHovered ? '#ffffff' : strokeColor}
                          stroke="#000000"
                          strokeWidth={1}
                          className="cursor-pointer hover:scale-150 transition-all"
                          onMouseEnter={() => setHoveredPoint(pt)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })}

                    {/* Term Label at end of line */}
                    {row.length > 0 && (
                      <text
                        x={scaleX(row[row.length - 1].strike) + 6}
                        y={scaleY(row[row.length - 1].iv) + 3}
                        fill={strokeColor}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {exp.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* X Axis: Strikes */}
              <g className="x-axis">
                <line x1="60" y1="300" x2="720" y2="300" stroke="#4a5568" strokeWidth="1" />
                {strikes.map((stk, i) => {
                  if (i % 2 !== 0 && i !== strikes.length - 1) return null;
                  const minS = strikes[0];
                  const maxS = strikes[strikes.length - 1];
                  const x = 60 + ((stk - minS) / (maxS - minS)) * 660;
                  return (
                    <g key={i}>
                      <line x1={x} y1="300" x2={x} y2="305" stroke="#718096" />
                      <text x={x} y="320" fill="#a0aec0" fontSize="10" fontFamily="monospace" textAnchor="middle">
                        ${stk}
                      </text>
                    </g>
                  );
                })}
                <text x="390" y="345" fill="#718096" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  Strike Price ($)
                </text>
              </g>

              {/* Y Axis: Implied Volatility */}
              <g className="y-axis">
                <line x1="60" y1="40" x2="60" y2="300" stroke="#4a5568" strokeWidth="1" />
                {[0, 1, 2, 3, 4].map(i => {
                  const y = 40 + i * 65;
                  const val = ivMax - (i / 4) * (ivMax - ivMin);
                  return (
                    <g key={i}>
                      <line x1="55" y1={y} x2="60" y2={y} stroke="#718096" />
                      <text x="50" y={y + 3} fill="#a0aec0" fontSize="10" fontFamily="monospace" textAnchor="end">
                        {(val * 100).toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
                <text x="25" y="170" fill="#718096" fontSize="11" fontFamily="monospace" textAnchor="middle" transform="rotate(-90 25 170)" fontWeight="bold">
                  Implied Volatility (IV)
                </text>
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* VIEW 3: 2D MATRIX CONTOUR HEATMAP */}
      {viewMode === 'CONTOUR_HEATMAP' && (
        <div className="bg-[#07080a] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div>
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <BarChart2 size={18} className="text-cyan-400" /> Strike vs Expiration Volatility Matrix
            </h4>
            <p className="text-xs text-gray-400">
              Interpolated grid of Implied Volatility percentages with quantitative cell inspector.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-center border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-[#121418] border-b border-gray-800 text-gray-400">
                  <th className="py-3 px-3 text-left font-bold text-white">Expiration \ Strike</th>
                  {strikes.map((stk, idx) => (
                    <th key={idx} className={`py-3 px-2 font-bold ${stk === targetStrike ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-300'}`}>
                      ${stk}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {surfaceMatrix.map((row, rIdx) => {
                  const exp = expirations[rIdx];
                  return (
                    <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 text-left font-bold text-gray-300 bg-[#0c0d10] whitespace-nowrap">
                        {exp.label}
                      </td>
                      {row.map((pt, cIdx) => {
                        const cellColor = getColorForIV(pt.iv);
                        const isTarget = pt.isTarget;

                        return (
                          <td 
                            key={cIdx} 
                            className={`py-2.5 px-2 transition-all cursor-pointer relative group ${
                              isTarget ? 'ring-2 ring-cyan-400 ring-inset font-black' : ''
                            }`}
                            style={{
                              backgroundColor: `${cellColor}22`
                            }}
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            <span style={{ color: cellColor }} className="font-bold">
                              {(pt.iv * 100).toFixed(0)}%
                            </span>

                            {isTarget && (
                              <span className="block text-[8px] text-cyan-300 uppercase tracking-tighter">
                                Target
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quantitative Insights & Interpretation Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs bg-[#0c0d10] p-4 rounded-xl border border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold uppercase text-[11px]">
            <Info size={13} /> Volatility Skew (Crash Edge)
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px]">
            OTM put strikes trade at higher IV relative to OTM calls, reflecting market downside hedging premium. Steep skew favors Put Credit Spreads & ratio put structures.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold uppercase text-[11px]">
            <TrendingUp size={13} /> Term Structure (VRP)
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px]">
            {termStructureSlope >= 0 
              ? 'Normal Contango regime: Long-dated options price higher forward uncertainty. Favorable for Calendar & Diagonal debit spreads.'
              : 'Inverted Backwardation regime: Elevated near-term event risk/catalyst. Short-dated premium capture is mathematically optimal.'}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-purple-400 font-mono font-bold uppercase text-[11px]">
            <Zap size={13} /> Target Strike Position
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px]">
            Strategy recommended strike of <strong>${recommendation.strikePrice}</strong> ({recommendation.strategy}) sits at <strong>{((recommendation.strikePrice / spotPrice) * 100).toFixed(1)}% moneyness</strong> with base IV of <strong>{baseATMIV}%</strong>.
          </p>
        </div>
      </div>

    </div>
  );
};
