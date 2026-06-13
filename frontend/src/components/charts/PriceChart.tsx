"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useChartData, type ChartInterval } from "@/hooks/useStockPrice";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush,
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

export default function PriceChart({ ticker, height = 320 }: Props) {
  const [interval, setActiveInterval] = useState<ChartInterval>("day");
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);
  const [visibleMAs, setVisibleMAs] = useState<Set<string>>(
    () => new Set(MA_LINES.map((m) => m.key))
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: history = [], isLoading } = useChartData(ticker, interval);

  const chartData: ChartRow[] = history.map((p) => ({
    date: formatDate(p.date, interval),
    close: p.close,
    volume: p.volume,
    MA20:  p.ma20  ?? undefined,
    MA50:  p.ma50  ?? undefined,
    MA60:  p.ma60  ?? undefined,
    MA120: p.ma120 ?? undefined,
    MA200: p.ma200 ?? undefined,
    MA240: p.ma240 ?? undefined,
  }));

  const startIdx = brushRange?.[0] ?? 0;
  const endIdx   = brushRange?.[1] ?? Math.max(0, chartData.length - 1);

  const visibleSlice = chartData.slice(startIdx, endIdx + 1);
  const allVisiblePrices = visibleSlice.flatMap((d) => {
    const maVals = MA_LINES
      .filter(({ key }) => visibleMAs.has(key))
      .map(({ key }) => d[key as keyof ChartRow] as number | undefined);
    return ([d.close, ...maVals] as (number | undefined)[]).filter(
      (v): v is number => typeof v === "number" && !isNaN(v)
    );
  });
  const minP = allVisiblePrices.length ? Math.min(...allVisiblePrices) * 0.98 : 0;
  const maxP = allVisiblePrices.length ? Math.max(...allVisiblePrices) * 1.02 : 100;

  const handleInterval = useCallback((v: ChartInterval) => {
    setActiveInterval(v);
    setBrushRange(null);
  }, []);

  const toggleMA = useCallback((key: string) => {
    setVisibleMAs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const zoomIn = useCallback(() => {
    const s = startIdx, e = endIdx, span = e - s;
    if (span <= 10) return;
    const q = Math.floor(span / 4);
    setBrushRange([s + q, e - q]);
  }, [startIdx, endIdx]);

  const zoomOut = useCallback(() => {
    const s = startIdx, e = endIdx, span = e - s;
    const q = Math.floor(span / 2);
    setBrushRange([Math.max(0, s - q), Math.min(chartData.length - 1, e + q)]);
  }, [startIdx, endIdx, chartData.length]);

  const resetZoom = useCallback(() => setBrushRange(null), []);

  // --- 최신값 refs (이벤트 리스너 stale closure 방지) ---
  const zoomInRef  = useRef(zoomIn);
  const zoomOutRef = useRef(zoomOut);
  const startIdxRef  = useRef(startIdx);
  const endIdxRef    = useRef(endIdx);
  const chartLenRef  = useRef(chartData.length);
  useEffect(() => { zoomInRef.current  = zoomIn;           }, [zoomIn]);
  useEffect(() => { zoomOutRef.current = zoomOut;          }, [zoomOut]);
  useEffect(() => { startIdxRef.current  = startIdx;       }, [startIdx]);
  useEffect(() => { endIdxRef.current    = endIdx;         }, [endIdx]);
  useEffect(() => { chartLenRef.current  = chartData.length; }, [chartData.length]);

  // --- 휠: 확대/축소 ---
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

  // --- 드래그: 좌우 pan ---
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const drag = { active: false, startX: 0, startS: 0, startE: 0 };

    const beginDrag = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      if (clientY > rect.bottom - 35) return;
      drag.active = true;
      drag.startX = clientX;
      drag.startS = startIdxRef.current;
      drag.startE = endIdxRef.current;
      el.style.cursor = "grabbing";
    };

    const moveDrag = (clientX: number) => {
      if (!drag.active) return;
      const visibleCount = drag.startE - drag.startS + 1;
      const pxPerBar = (el.offsetWidth || 600) / visibleCount;
      const shift = Math.round(-(clientX - drag.startX) / pxPerBar);
      const len = chartLenRef.current;
      const newS = Math.max(0, Math.min(len - visibleCount, drag.startS + shift));
      setBrushRange([newS, newS + visibleCount - 1]);
    };

    const endDrag = () => {
      if (!drag.active) return;
      drag.active = false;
      el.style.cursor = "grab";
    };

    // Mouse
    const onMouseDown = (e: MouseEvent) => beginDrag(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX);
    const onMouseUp   = () => endDrag();

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      beginDrag(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      moveDrag(e.touches[0].clientX);
    };
    const onTouchEnd = () => endDrag();

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

  return (
    <div className="space-y-2">
      {/* 봉 종류 + 줌 컨트롤 */}
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">드래그·휠로 이동/확대</span>
          <button onClick={zoomIn}    className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="확대">+</button>
          <button onClick={zoomOut}   className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="축소">−</button>
          <button onClick={resetZoom} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded" title="초기화">↺</button>
        </div>
      </div>

      {/* 이평선 토글 */}
      <div className="flex flex-wrap gap-1.5">
        {MA_LINES.map(({ key, color, name }) => {
          const on = visibleMAs.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleMA(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                on
                  ? "bg-gray-700 border-transparent text-white"
                  : "bg-transparent border-gray-700 text-gray-500"
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: on ? color : "#4B5563" }}
              />
              {name}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">차트 로딩 중...</div>
      ) : chartData.length === 0 ? (
        <div className="h-20 flex items-center justify-center text-gray-500 text-sm">가격 데이터 없음</div>
      ) : (
        <div ref={chartContainerRef} style={{ touchAction: "none", userSelect: "none" }}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
              />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 10 }} />
              <Bar yAxisId="vol" dataKey="volume" fill="#4B5563" opacity={0.35} name="거래량" />
              <Line yAxisId="price" type="monotone" dataKey="close" stroke="#60A5FA" dot={false} strokeWidth={2} name="종가" />
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
              <Brush
                dataKey="date"
                height={22}
                stroke="#4B5563"
                fill="#111827"
                travellerWidth={7}
                startIndex={startIdx}
                endIndex={endIdx}
                onChange={(e: { startIndex?: number; endIndex?: number }) =>
                  setBrushRange([e.startIndex ?? 0, e.endIndex ?? chartData.length - 1])
                }
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
