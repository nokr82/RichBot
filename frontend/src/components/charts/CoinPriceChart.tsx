"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useCoinChart } from "@/hooks/useCoin";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type CoinChartInterval = "60m" | "day" | "week" | "month";

const INTERVALS: { label: string; value: CoinChartInterval }[] = [
  { label: "60분", value: "60m" },
  { label: "일봉", value: "day" },
  { label: "주봉", value: "week" },
  { label: "월봉", value: "month" },
];

const PRESETS = [
  { label: "1M",  key: "1M",  count: 30  },
  { label: "3M",  key: "3M",  count: 90  },
  { label: "6M",  key: "6M",  count: 180 },
  { label: "1Y",  key: "1Y",  count: 365 },
  { label: "전체", key: "all", count: null as number | null },
];

const MA_LINES = [
  { key: "MA7",   color: "#FB923C", name: "MA7"   },
  { key: "MA25",  color: "#F59E0B", name: "MA25"  },
  { key: "MA50",  color: "#84CC16", name: "MA50"  },
  { key: "MA99",  color: "#22D3EE", name: "MA99"  },
  { key: "MA200", color: "#F87171", name: "MA200" },
];

type ChartRow = {
  date: string;
  open?: number; high?: number; low?: number;
  close: number; volume: number;
  MA7?: number; MA25?: number; MA50?: number; MA99?: number; MA200?: number;
};

function tickFmt(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return v.toLocaleString();
}

function makeCandleShape(minP: number, maxP: number) {
  return function CandleShape(props: {
    x?: number; width?: number;
    open?: number; high?: number; low?: number; close?: number;
    background?: { x: number; y: number; width: number; height: number };
  }) {
    const { x = 0, width = 0, background, open, high, low, close } = props;
    if (!background || open == null || high == null || low == null || close == null) return null;
    const range = maxP - minP;
    if (range === 0 || background.height === 0) return null;
    const toY = (price: number) => background.y + ((maxP - price) / range) * background.height;
    const highY = toY(high), lowY = toY(low), openY = toY(open), closeY = toY(close);
    const isUp = close >= open;
    const color = isUp ? "#34D399" : "#F87171";
    const bodyTop = Math.min(openY, closeY);
    const bodyH = Math.max(1, Math.abs(closeY - openY));
    const cx = x + width / 2;
    const bodyW = Math.max(2, width - 2);
    return (
      <g>
        <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
        <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
      </g>
    );
  };
}

export default function CoinPriceChart({ ticker, height = 320 }: { ticker: string; height?: number }) {
  const [chartInterval, setChartInterval] = useState<CoinChartInterval>("day");
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);
  const [activePreset, setActivePreset] = useState("6M");
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [visibleMAs, setVisibleMAs] = useState<Set<string>>(new Set(MA_LINES.map((m) => m.key)));
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: history = [], isLoading } = useCoinChart(ticker, chartInterval);

  const chartData: ChartRow[] = history.map((p) => ({
    date:   p.date.slice(0, chartInterval === "60m" ? 16 : 10),
    open:   p.open  ?? undefined,
    high:   p.high  ?? undefined,
    low:    p.low   ?? undefined,
    close:  p.close,
    volume: p.volume,
    MA7:    p.ma7   ?? undefined,
    MA25:   p.ma25  ?? undefined,
    MA50:   p.ma50  ?? undefined,
    MA99:   p.ma99  ?? undefined,
    MA200:  p.ma200 ?? undefined,
  }));

  useEffect(() => {
    if (chartData.length === 0) return;
    const preset = PRESETS.find((p) => p.key === activePreset);
    if (!preset || preset.count === null) { setBrushRange(null); return; }
    const count = Math.min(preset.count, chartData.length);
    setBrushRange([chartData.length - count, chartData.length - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData.length, chartInterval]);

  const startIdx = brushRange?.[0] ?? 0;
  const endIdx   = brushRange?.[1] ?? Math.max(0, chartData.length - 1);
  const visibleSlice = chartData.slice(startIdx, endIdx + 1);

  const allPrices = visibleSlice.flatMap((d) => {
    const maVals = MA_LINES.filter(({ key }) => visibleMAs.has(key)).map(({ key }) => d[key as keyof ChartRow] as number | undefined);
    const ohlc = chartType === "candle" ? [d.high, d.low] : [d.close];
    return [...ohlc, ...maVals].filter((v): v is number => typeof v === "number" && !isNaN(v));
  });
  const minP = allPrices.length ? Math.min(...allPrices) * 0.98 : 0;
  const maxP = allPrices.length ? Math.max(...allPrices) * 1.02 : 100;

  const startIdxRef = useRef(startIdx);
  const endIdxRef   = useRef(endIdx);
  const chartLenRef = useRef(chartData.length);
  useEffect(() => { startIdxRef.current = startIdx; }, [startIdx]);
  useEffect(() => { endIdxRef.current   = endIdx;   }, [endIdx]);
  useEffect(() => { chartLenRef.current = chartData.length; }, [chartData.length]);

  const applyPreset = useCallback((key: string, count: number | null) => {
    setActivePreset(key);
    const len = history.length;
    if (count === null || len === 0) { setBrushRange(null); return; }
    setBrushRange([len - Math.min(count, len), len - 1]);
  }, [history.length]);

  const zoomIn = useCallback(() => {
    setActivePreset("");
    const s = startIdxRef.current, e = endIdxRef.current, span = e - s;
    if (span <= 10) return;
    const q = Math.floor(span / 4);
    setBrushRange([s + q, e - q]);
  }, []);

  const zoomOut = useCallback(() => {
    setActivePreset("");
    const s = startIdxRef.current, e = endIdxRef.current, span = e - s;
    const q = Math.floor(span / 2);
    setBrushRange([Math.max(0, s - q), Math.min(chartLenRef.current - 1, e + q)]);
  }, []);

  const zoomInRef = useRef(zoomIn);
  const zoomOutRef = useRef(zoomOut);
  useEffect(() => { zoomInRef.current  = zoomIn;  }, [zoomIn]);
  useEffect(() => { zoomOutRef.current = zoomOut; }, [zoomOut]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); if (e.deltaY < 0) zoomInRef.current(); else zoomOutRef.current(); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const drag = { active: false, startX: 0, startS: 0, startE: 0 };
    const beginDrag = (x: number) => { drag.active = true; drag.startX = x; drag.startS = startIdxRef.current; drag.startE = endIdxRef.current; el.style.cursor = "grabbing"; };
    const moveDrag  = (x: number) => {
      if (!drag.active) return;
      setActivePreset("");
      const vc = drag.startE - drag.startS + 1;
      const pxPerBar = (el.offsetWidth || 600) / vc;
      const shift = Math.round(-(x - drag.startX) / pxPerBar);
      const newS = Math.max(0, Math.min(chartLenRef.current - vc, drag.startS + shift));
      setBrushRange([newS, newS + vc - 1]);
    };
    const endDrag = () => { if (!drag.active) return; drag.active = false; el.style.cursor = "grab"; };
    const onMD = (e: MouseEvent) => beginDrag(e.clientX);
    const onMM = (e: MouseEvent) => moveDrag(e.clientX);
    const onMU = () => endDrag();
    el.addEventListener("mousedown", onMD);
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    el.style.cursor = "grab";
    return () => { el.removeEventListener("mousedown", onMD); window.removeEventListener("mousemove", onMM); window.removeEventListener("mouseup", onMU); };
  }, []);

  const CandleShape = makeCandleShape(minP, maxP);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => { setChartInterval(value); setBrushRange(null); setActivePreset("6M"); }}
              className={`px-2 py-0.5 text-xs rounded ${chartInterval === value ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-gray-600">
            {(["line", "candle"] as const).map((t) => (
              <button key={t} onClick={() => setChartType(t)} className={`px-2.5 py-0.5 text-xs ${chartType === t ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                {t === "line" ? "라인" : "캔들"}
              </button>
            ))}
          </div>
          <button onClick={() => zoomInRef.current()}  className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded">+</button>
          <button onClick={() => zoomOutRef.current()} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded">−</button>
          <button onClick={() => { setActivePreset("전체"); setBrushRange(null); }} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded">↺</button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {PRESETS.map(({ label, key, count }) => (
            <button key={key} onClick={() => applyPreset(key, count)}
              className={`px-2.5 py-0.5 text-xs rounded font-medium ${activePreset === key ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`}
            >{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {MA_LINES.map(({ key, color, name }) => {
            const on = visibleMAs.has(key);
            return (
              <button key={key} onClick={() => setVisibleMAs((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${on ? "bg-gray-700 border-transparent text-white" : "bg-transparent border-gray-700 text-gray-500"}`}
              >
                <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: on ? color : "#4B5563" }} />
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">차트 로딩 중...</div>
      ) : chartData.length === 0 ? (
        <div className="h-20 flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>
      ) : (
        <div ref={chartContainerRef} style={{ touchAction: "none", userSelect: "none" }}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={visibleSlice} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="price" domain={[minP, maxP]} tick={{ fill: "#9CA3AF", fontSize: 10 }} tickFormatter={tickFmt} width={60} />
              <YAxis yAxisId="vol" orientation="right" tick={{ fill: "#6B7280", fontSize: 9 }}
                tickFormatter={(v: number) => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" : (v / 1_000).toFixed(1) + "K"} width={44} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#F9FAFB" }}
                formatter={(value: unknown) => typeof value === "number" ? value.toLocaleString() : String(value)} />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 10 }} />
              <Bar yAxisId="vol" dataKey="volume" fill="#4B5563" opacity={0.35} name="거래량" />
              {chartType === "line" && (
                <Line yAxisId="price" type="monotone" dataKey="close" stroke="#60A5FA" dot={false} strokeWidth={2} name="종가" />
              )}
              {chartType === "candle" && (
                <Bar yAxisId="price" dataKey="close" name="캔들" shape={<CandleShape />} isAnimationActive={false} />
              )}
              {MA_LINES.filter(({ key }) => visibleMAs.has(key)).map(({ key, color, name }) => (
                <Line key={key} yAxisId="price" type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={1.5} strokeDasharray="4 2" name={name} connectNulls={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
