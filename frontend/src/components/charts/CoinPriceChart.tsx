"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useCoinChart } from "@/hooks/useCoin";
import type { CoinPriceSnapshot } from "@/types";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type Time,
} from "lightweight-charts";

type CoinChartInterval = "15m" | "60m" | "day" | "week" | "month" | "year";

const INTERVALS: { label: string; value: CoinChartInterval }[] = [
  { label: "15분", value: "15m"   },
  { label: "60분", value: "60m"   },
  { label: "일봉",  value: "day"   },
  { label: "주봉",  value: "week"  },
  { label: "월봉",  value: "month" },
  { label: "연봉",  value: "year"  },
];

const PRESETS = [
  { label: "1M",  key: "1M",  months: 1  },
  { label: "3M",  key: "3M",  months: 3  },
  { label: "6M",  key: "6M",  months: 6  },
  { label: "1Y",  key: "1Y",  months: 12 },
  { label: "전체", key: "all", months: 0  },
];

const MA_LINES = [
  { key: "ma7",   color: "#FB923C", label: "MA7"   },
  { key: "ma25",  color: "#F59E0B", label: "MA25"  },
  { key: "ma50",  color: "#84CC16", label: "MA50"  },
  { key: "ma99",  color: "#22D3EE", label: "MA99"  },
  { key: "ma200", color: "#F87171", label: "MA200" },
];

const COIN_CHART_SETTINGS_KEY = "richbot-coin-chart-settings";

type ChartSettings = {
  interval: CoinChartInterval;
  chartType: "line" | "candle";
  activePreset: string;
  visibleMAs: string[];
};

function loadSettings(): Partial<ChartSettings> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(COIN_CHART_SETTINGS_KEY) ?? "{}") ?? {}; }
  catch { return {}; }
}
function saveSettings(s: ChartSettings) {
  try { localStorage.setItem(COIN_CHART_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function toTime(dateStr: string, interval: CoinChartInterval): Time {
  if (interval === "15m" || interval === "60m") {
    return Math.floor(new Date(dateStr).getTime() / 1000) as UTCTimestamp;
  }
  const d =
    dateStr.length === 4 ? `${dateStr}-01-01` :
    dateStr.length === 7 ? `${dateStr}-01`    :
    dateStr.slice(0, 10);
  return d as Time;
}

function getMAValue(p: CoinPriceSnapshot, key: string): number | undefined {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : undefined;
}

export default function CoinPriceChart({ ticker, height = 400 }: { ticker: string; height?: number }) {
  const s = loadSettings();

  const [interval, setInterval_] = useState<CoinChartInterval>(s.interval ?? "day");
  const [chartType, setChartType] = useState<"line" | "candle">(s.chartType ?? "candle");
  const [activePreset, setActivePreset] = useState(s.activePreset ?? "6M");
  const [visibleMAs, setVisibleMAs] = useState<Set<string>>(
    new Set(s.visibleMAs ?? MA_LINES.map((m) => m.key))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef  = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const volRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs    = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());

  const { data: history = [], isLoading } = useCoinChart(ticker, interval);

  // ── 차트 초기화 (마운트 1회) ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#B2B5BE",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1E2029", style: LineStyle.Solid },
        horzLines: { color: "#1E2029", style: LineStyle.Solid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2B2B43" },
      timeScale: {
        borderColor: "#2B2B43",
        timeVisible: false,
        secondsVisible: false,
      },
      width: containerRef.current.offsetWidth,
      height,
    });
    chartRef.current = chart;

    // 거래량 (하단 약 15%)
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volRef.current = vol;

    // 캔들 시리즈
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candleRef.current = candle;

    // 라인 시리즈 (기본 숨김)
    const line = chart.addSeries(LineSeries, {
      color: "#2962FF",
      lineWidth: 2,
      priceLineVisible: false,
      visible: false,
    });
    lineRef.current = line;

    // MA 시리즈
    MA_LINES.forEach(({ key, color }) => {
      const ma = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maRefs.current.set(key, ma);
    });

    // 리사이즈 대응
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.offsetWidth, height);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인터벌 변경 시 timeVisible 업데이트
  useEffect(() => {
    const isIntraday = interval === "15m" || interval === "60m";
    chartRef.current?.timeScale().applyOptions({ timeVisible: isIntraday });
  }, [interval]);

  // ── 데이터 업데이트 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!history.length || !chartRef.current) return;

    // 캔들
    const candleData = history
      .filter((p) => p.open != null && p.high != null && p.low != null)
      .map((p) => ({
        time:  toTime(p.date, interval),
        open:  p.open!,
        high:  p.high!,
        low:   p.low!,
        close: p.close,
      }));
    candleRef.current?.setData(candleData);

    // 라인
    lineRef.current?.setData(
      history.map((p) => ({ time: toTime(p.date, interval), value: p.close }))
    );

    // 거래량
    volRef.current?.setData(
      history.map((p) => ({
        time:  toTime(p.date, interval),
        value: p.volume,
        color: p.close >= (p.open ?? p.close)
          ? "rgba(38,166,154,0.5)"
          : "rgba(239,83,80,0.5)",
      }))
    );

    // MA
    MA_LINES.forEach(({ key }) => {
      const maSeries = maRefs.current.get(key);
      if (!maSeries) return;
      const maData = history
        .filter((p) => getMAValue(p, key) != null)
        .map((p) => ({ time: toTime(p.date, interval), value: getMAValue(p, key)! }));
      (maSeries as ISeriesApi<"Line">).setData(maData);
    });

    applyPresetRange(activePreset, history);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, interval]);

  // ── 차트 타입 전환 ──────────────────────────────────────────────────────
  useEffect(() => {
    candleRef.current?.applyOptions({ visible: chartType === "candle" });
    lineRef.current?.applyOptions({ visible: chartType === "line" });
  }, [chartType]);

  // ── MA 표시/숨김 ────────────────────────────────────────────────────────
  useEffect(() => {
    MA_LINES.forEach(({ key }) => {
      maRefs.current.get(key)?.applyOptions({ visible: visibleMAs.has(key) });
    });
  }, [visibleMAs]);

  // ── 설정 저장 ───────────────────────────────────────────────────────────
  useEffect(() => {
    saveSettings({ interval, chartType, activePreset, visibleMAs: [...visibleMAs] });
  }, [interval, chartType, activePreset, visibleMAs]);

  // ── 프리셋 범위 적용 ────────────────────────────────────────────────────
  const applyPresetRange = useCallback(
    (key: string, data: CoinPriceSnapshot[]) => {
      if (!chartRef.current || !data.length) return;
      if (key === "all") {
        chartRef.current.timeScale().fitContent();
        return;
      }
      const preset = PRESETS.find((p) => p.key === key);
      if (!preset) return;
      const lastDate = new Date(data[data.length - 1].date);
      const fromDate = new Date(lastDate);
      fromDate.setMonth(fromDate.getMonth() - preset.months);
      chartRef.current.timeScale().setVisibleRange({
        from: toTime(fromDate.toISOString().slice(0, 10), interval),
        to:   toTime(lastDate.toISOString().slice(0, 10), interval),
      });
    },
    [interval]
  );

  const handlePreset = useCallback(
    (key: string) => {
      setActivePreset(key);
      applyPresetRange(key, history);
    },
    [applyPresetRange, history]
  );

  const handleInterval = useCallback((v: CoinChartInterval) => {
    setInterval_(v);
    setActivePreset("6M");
  }, []);

  const toggleMA = useCallback((key: string) => {
    setVisibleMAs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const fitAll = useCallback(() => {
    setActivePreset("all");
    chartRef.current?.timeScale().fitContent();
  }, []);

  return (
    <div className="space-y-2">
      {/* 컨트롤 1행: 봉 종류 | 차트 타입 + 전체보기 */}
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
            {(["line", "candle"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2.5 py-0.5 text-xs transition-colors ${
                  chartType === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {t === "line" ? "라인" : "캔들"}
              </button>
            ))}
          </div>
          <button
            onClick={fitAll}
            className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded"
            title="전체 보기"
          >
            ↺
          </button>
        </div>
      </div>

      {/* 컨트롤 2행: 기간 프리셋 | 이평선 토글 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {PRESETS.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => handlePreset(key)}
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

        <div className="flex flex-wrap gap-1">
          {MA_LINES.map(({ key, color, label }) => {
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
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ height }} />
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
            style={{ height }}
          >
            차트 로딩 중...
          </div>
        )}
      </div>
    </div>
  );
}

