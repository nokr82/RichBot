"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useChartData, type ChartInterval } from "@/hooks/useStockPrice";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Props {
  ticker: string;
  height?: number;
}

const INTERVALS: { label: string; value: ChartInterval }[] = [
  { label: "15분", value: "15m" },
  { label: "일봉", value: "day" },
  { label: "주봉", value: "week" },
  { label: "월봉", value: "month" },
  { label: "연봉", value: "year" },
];

// 프리셋별 마지막 N개 봉 (null = 전체)
const PRESETS: { label: string; key: string; count: number | null }[] = [
  { label: "1M",  key: "1M",  count: 22  },
  { label: "3M",  key: "3M",  count: 66  },
  { label: "6M",  key: "6M",  count: 132 },
  { label: "1Y",  key: "1Y",  count: 252 },
  { label: "전체", key: "all", count: null },
];

const MA_LINES = [
  { key: "MA20",  color: "#F59E0B", name: "MA20" },
  { key: "MA50",  color: "#84CC16", name: "MA50" },
  { key: "MA60",  color: "#34D399", name: "MA60" },
  { key: "MA120", color: "#22D3EE", name: "MA120" },
  { key: "MA200", color: "#F87171", name: "MA200" },
  { key: "MA240", color: "#A78BFA", name: "MA240" },
];

type ChartRow = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume: number;
  MA20?: number;
  MA50?: number;
  MA60?: number;
  MA120?: number;
  MA200?: number;
  MA240?: number;
};

function formatDate(dateStr: string, interval: ChartInterval): string {
  if (interval === "15m") return dateStr.slice(11, 16);
  if (interval === "year") return dateStr.slice(0, 4);
  if (interval === "month") return dateStr.slice(0, 7);
  return dateStr.slice(5, 10);
}

function tickFmt(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return v.toString();
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

    const toY = (price: number) =>
      background.y + ((maxP - price) / range) * background.height;

    const highY  = toY(high);
    const lowY   = toY(low);
    const openY  = toY(open);
    const closeY = toY(close);

    const isUp    = close >= open;
    const color   = isUp ? "#34D399" : "#F87171";
    const bodyTop = Math.min(openY, closeY);
    const bodyH   = Math.max(1, Math.abs(closeY - openY));
    const cx      = x + width / 2;
    const bodyW   = Math.max(2, width - 2);

    return (
      <g>
        <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
        <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH}
          fill={color} stroke={color} strokeWidth={0.5} />
      </g>
    );
  };
}

const CHART_SETTINGS_KEY = "richbot-chart-settings";
type ChartSettings = {
  interval: ChartInterval;
  chartType: "line" | "candle";
  activePreset: string;
  visibleMAs: string[];
};
function loadChartSettings(): Partial<ChartSettings> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CHART_SETTINGS_KEY) ?? "{}") ?? {}; }
  catch { return {}; }
}
function saveChartSettings(s: ChartSettings) {
  try { localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export default function PriceChart({ ticker, height = 320 }: Props) {
  const [interval, setActiveInterval] = useState<ChartInterval>(() => {
    const s = loadChartSettings();
    return s.interval ?? "day";
  });
  const [brushRange, setBrushRange]   = useState<[number, number] | null>(null);
  const [activePreset, setActivePreset] = useState<string>(() => {
    const s = loadChartSettings();
    return s.activePreset ?? "6M";
  });
  const [chartType, setChartType]     = useState<"line" | "candle">(() => {
    const s = loadChartSettings();
    return s.chartType ?? "line";
  });
  const [visibleMAs, setVisibleMAs]   = useState<Set<string>>(() => {
    const s = loadChartSettings();
    return new Set<string>(s.visibleMAs ?? MA_LINES.map((m) => m.key));
  });
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: history = [], isLoading } = useChartData(ticker, interval);

  const chartData: ChartRow[] = history.map((p) => ({
    date:   formatDate(p.date, interval),
    open:   p.open   ?? undefined,
    high:   p.high   ?? undefined,
    low:    p.low    ?? undefined,
    close:  p.close,
    volume: p.volume,
    MA20:   p.ma20   ?? undefined,
    MA50:   p.ma50   ?? undefined,
    MA60:   p.ma60   ?? undefined,
    MA120:  p.ma120  ?? undefined,
    MA200:  p.ma200  ?? undefined,
    MA240:  p.ma240  ?? undefined,
  }));

  // 데이터 로드 완료 시 기본 프리셋(6M) 적용
  useEffect(() => {
    if (chartData.length === 0) return;
    const preset = PRESETS.find((p) => p.key === activePreset);
    if (!preset || preset.count === null) {
      setBrushRange(null);
      return;
    }
    const count = Math.min(preset.count, chartData.length);
    setBrushRange([chartData.length - count, chartData.length - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData.length, interval]);

  const startIdx = brushRange?.[0] ?? 0;
  const endIdx   = brushRange?.[1] ?? Math.max(0, chartData.length - 1);

  const visibleSlice = chartData.slice(startIdx, endIdx + 1);
  const allVisiblePrices = visibleSlice.flatMap((d) => {
    const maVals = MA_LINES
      .filter(({ key }) => visibleMAs.has(key))
      .map(({ key }) => d[key as keyof ChartRow] as number | undefined);
    const ohlc = chartType === "candle" ? [d.high, d.low] : [d.close];
    return ([...ohlc, ...maVals] as (number | undefined)[]).filter(
      (v): v is number => typeof v === "number" && !isNaN(v)
    );
  });
  const minP = allVisiblePrices.length ? Math.min(...allVisiblePrices) * 0.98 : 0;
  const maxP = allVisiblePrices.length ? Math.max(...allVisiblePrices) * 1.02 : 100;

  const handleInterval = useCallback((v: ChartInterval) => {
    setActiveInterval(v);
    setBrushRange(null);
    setActivePreset("6M");
  }, []);

  const applyPreset = useCallback((key: string, count: number | null) => {
    setActivePreset(key);
    if (count === null) {
      setBrushRange(null);
      return;
    }
    // chartData.length는 렌더 시점 값 — 최신값 직접 읽기
    setBrushRange((prev) => {
      void prev;
      return null; // 아래 useEffect로 재계산
    });
    // count를 ref로 넘겨 useEffect에서 처리하는 대신 직접 계산
    // chartData는 렌더 스코프 변수라 여기서 사용 가능
    const len = history.length;
    if (len === 0) return;
    const n = Math.min(count, len);
    setBrushRange([len - n, len - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  const toggleMA = useCallback((key: string) => {
    setVisibleMAs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const zoomIn = useCallback(() => {
    setActivePreset("");
    const s = startIdx, e = endIdx, span = e - s;
    if (span <= 10) return;
    const q = Math.floor(span / 4);
    setBrushRange([s + q, e - q]);
  }, [startIdx, endIdx]);

  const zoomOut = useCallback(() => {
    setActivePreset("");
    const s = startIdx, e = endIdx, span = e - s;
    const q = Math.floor(span / 2);
    setBrushRange([Math.max(0, s - q), Math.min(chartData.length - 1, e + q)]);
  }, [startIdx, endIdx, chartData.length]);

  const resetZoom = useCallback(() => {
    setActivePreset("전체");
    setBrushRange(null);
  }, []);

  const zoomInRef   = useRef(zoomIn);
  const zoomOutRef  = useRef(zoomOut);
  const startIdxRef = useRef(startIdx);
  const endIdxRef   = useRef(endIdx);
  const chartLenRef = useRef(chartData.length);
  useEffect(() => { zoomInRef.current   = zoomIn;           }, [zoomIn]);
  useEffect(() => { zoomOutRef.current  = zoomOut;          }, [zoomOut]);
  useEffect(() => { startIdxRef.current = startIdx;         }, [startIdx]);
  useEffect(() => { endIdxRef.current   = endIdx;           }, [endIdx]);
  useEffect(() => { chartLenRef.current = chartData.length; }, [chartData.length]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomInRef.current();
      else zoomOutRef.current();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const drag = { active: false, startX: 0, startS: 0, startE: 0 };
    const beginDrag = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      if (clientY > rect.bottom - 10) return;
      drag.active = true; drag.startX = clientX;
      drag.startS = startIdxRef.current; drag.startE = endIdxRef.current;
      el.style.cursor = "grabbing";
    };
    const moveDrag = (clientX: number) => {
      if (!drag.active) return;
      setActivePreset("");
      const visibleCount = drag.startE - drag.startS + 1;
      const pxPerBar = (el.offsetWidth || 600) / visibleCount;
      const shift = Math.round(-(clientX - drag.startX) / pxPerBar);
      const len = chartLenRef.current;
      const newS = Math.max(0, Math.min(len - visibleCount, drag.startS + shift));
      setBrushRange([newS, newS + visibleCount - 1]);
    };
    const endDrag = () => { if (!drag.active) return; drag.active = false; el.style.cursor = "grab"; };
    const onMouseDown  = (e: MouseEvent)  => beginDrag(e.clientX, e.clientY);
    const onMouseMove  = (e: MouseEvent)  => moveDrag(e.clientX);
    const onMouseUp    = ()               => endDrag();
    const onTouchStart = (e: TouchEvent)  => beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove  = (e: TouchEvent)  => { e.preventDefault(); moveDrag(e.touches[0].clientX); };
    const onTouchEnd   = ()               => endDrag();
    el.addEventListener("mousedown",  onMouseDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    el.style.cursor = "grab";
    return () => {
      el.removeEventListener("mousedown",  onMouseDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    saveChartSettings({ interval, chartType, activePreset, visibleMAs: [...visibleMAs] });
  }, [interval, chartType, activePreset, visibleMAs]);

  const CandleShape = makeCandleShape(minP, maxP);

  return (
    <div className="space-y-2">
      {/* 1행: 봉 종류 | 차트 타입 + 줌 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleInterval(value)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                interval === value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-gray-600">
            <button
              onClick={() => setChartType("line")}
              className={`px-2.5 py-0.5 text-xs transition-colors ${
                chartType === "line"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              라인
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={`px-2.5 py-0.5 text-xs transition-colors ${
                chartType === "candle"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              캔들
            </button>
          </div>
          <button onClick={zoomIn}    className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="확대">+</button>
          <button onClick={zoomOut}   className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="축소">−</button>
          <button onClick={resetZoom} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="전체">↺</button>
        </div>
      </div>

      {/* 2행: 기간 프리셋 | 이평선 토글 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* 기간 프리셋 */}
        <div className="flex gap-1">
          {PRESETS.map(({ label, key, count }) => (
            <button
              key={key}
              onClick={() => applyPreset(key, count)}
              className={`px-2.5 py-0.5 text-xs rounded font-medium transition-colors ${
                activePreset === key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 이평선 토글 */}
        <div className="flex flex-wrap gap-1">
          {MA_LINES.map(({ key, color, name }) => {
            const on = visibleMAs.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleMA(key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                  on
                    ? "bg-gray-700 border-transparent text-white"
                    : "bg-transparent border-gray-700 text-gray-500"
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: on ? color : "#4B5563" }}
                />
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">차트 로딩 중...</div>
      ) : chartData.length === 0 ? (
        <div className="h-20 flex items-center justify-center text-gray-500 text-sm">가격 데이터 없음</div>
      ) : (
        <div ref={chartContainerRef} style={{ touchAction: "none", userSelect: "none" }}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={visibleSlice} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                yAxisId="price"
                domain={[minP, maxP]}
                tick={{ fill: "#9CA3AF", fontSize: 10 }}
                tickFormatter={tickFmt}
                width={56}
              />
              <YAxis
                yAxisId="vol"
                orientation="right"
                tick={{ fill: "#6B7280", fontSize: 9 }}
                tickFormatter={(v: number) =>
                  v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + "M" : (v / 1_000).toFixed(0) + "K"
                }
                width={44}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#F9FAFB" }}
                formatter={(value: unknown) =>
                  typeof value === "number" ? value.toLocaleString() : String(value)
                }
              />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 10 }} />

              <Bar yAxisId="vol" dataKey="volume" fill="#4B5563" opacity={0.35} name="거래량" />

              {chartType === "line" && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke="#60A5FA"
                  dot={false}
                  strokeWidth={2}
                  name="종가"
                />
              )}

              {chartType === "candle" && (
                <Bar
                  yAxisId="price"
                  dataKey="close"
                  name="캔들"
                  shape={<CandleShape />}
                  isAnimationActive={false}
                />
              )}

              {MA_LINES.filter(({ key }) => visibleMAs.has(key)).map(({ key, color, name }) => (
                <Line
                  key={key}
                  yAxisId="price"
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  name={name}
                  connectNulls={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}