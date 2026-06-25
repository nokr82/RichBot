"use client";
import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import PriceChart from "@/components/charts/PriceChart";
import { formatKRW } from "@/lib/formatters";
import { useStocks, useAddStock, useDeleteStock } from "@/hooks/useWatchlist";
import type { StockSearchResult, PriceSnapshot } from "@/types";

interface AllStocksResponse {
  items: StockSearchResult[];
  total: number;
  building: boolean;
}

export default function AllStocksList() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const SIZE = 50;

  const { data, isLoading } = useQuery<AllStocksResponse>({
    queryKey: ["all-stocks", query, page],
    queryFn: () =>
      api.get("/api/stocks/all", { params: { q: query, page, size: SIZE } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // 관심종목 Set — 실시간으로 버튼 상태에 반영됨
  const { data: watchlist = [] } = useStocks();
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((s) => s.ticker)),
    [watchlist]
  );

  const addMutation = useAddStock();
  const deleteMutation = useDeleteStock();

  const handleSearch = useCallback((v: string) => {
    setQuery(v);
    setPage(1);
    setSelected(null);
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">전체종목</h1>
        {data?.building && (
          <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded-full animate-pulse">
            종목 캐시 구축 중...
          </span>
        )}
        {total > 0 && (
          <span className="text-sm text-gray-400">총 {total.toLocaleString()}개</span>
        )}
      </div>

      {/* 검색 */}
      <input
        className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        placeholder="종목명 또는 종목코드 검색..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* 종목 목록 (모바일에서 종목 선택 시 숨김) */}
        <div className={`flex-1 min-w-0${selected ? " hidden lg:block" : ""}`}>
          {isLoading ? (
            <p className="text-gray-400 text-center py-12">로딩 중...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              {data?.building ? "종목 목록을 가져오는 중입니다. 잠시 후 새로고침 해주세요." : "검색 결과가 없습니다."}
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((s) => {
                const inWatchlist = watchlistSet.has(s.ticker);
                const isPending =
                  (addMutation.isPending && (addMutation.variables as StockSearchResult)?.ticker === s.ticker) ||
                  (deleteMutation.isPending && deleteMutation.variables === s.ticker);
                return (
                  <div
                    key={s.ticker}
                    onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                      selected?.ticker === s.ticker
                        ? "bg-blue-700/30 border border-blue-600"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-white font-medium">{s.name}</span>
                        <span className="ml-2 text-gray-400 text-sm">{s.ticker}</span>
                      </div>
                      <span className="text-xs text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">
                        {s.market}
                      </span>
                      {inWatchlist && (
                        <span className="text-xs text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                          관심
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (inWatchlist) deleteMutation.mutate(s.ticker);
                        else addMutation.mutate(s);
                      }}
                      disabled={isPending}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium disabled:opacity-50 ${
                        inWatchlist
                          ? "bg-emerald-700 hover:bg-red-700 text-white"
                          : "bg-gray-600 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {isPending ? "..." : inWatchlist ? "− 관심" : "+ 관심"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-600 text-sm"
              >
                이전
              </button>
              <span className="text-gray-400 text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-600 text-sm"
              >
                다음
              </button>
            </div>
          )}
        </div>

        {/* 상세 차트 패널 (모바일에서 전체 너비) */}
        {selected && (
          <div className="w-full lg:max-w-lg lg:flex-shrink-0">
            <StockDetailPanel
              stock={selected}
              inWatchlist={watchlistSet.has(selected.ticker)}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StockDetailPanel({
  stock,
  inWatchlist,
  onClose,
}: {
  stock: StockSearchResult;
  inWatchlist: boolean;
  onClose: () => void;
}) {
  const addMutation = useAddStock();
  const deleteMutation = useDeleteStock();

  const { data: history = [], isLoading } = useQuery<PriceSnapshot[]>({
    queryKey: ["live-chart", stock.ticker],
    queryFn: () =>
      api.get(`/api/prices/${stock.ticker}/chart`, { params: { days: 90 } }).then((r) => r.data),
    staleTime: 15 * 60_000,
  });

  const isPending = addMutation.isPending || deleteMutation.isPending;
  const latest = history.at(-1);

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 lg:sticky lg:top-4">
      {/* 모바일 전용 뒤로가기 버튼 */}
      <button onClick={onClose} className="lg:hidden mb-3 text-gray-400 hover:text-white text-sm">
        ← 목록으로
      </button>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{stock.name}</h2>
            <span className="text-xs text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">{stock.market}</span>
          </div>
          <p className="text-gray-400 text-sm">{stock.ticker}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (inWatchlist) deleteMutation.mutate(stock.ticker);
              else addMutation.mutate(stock);
            }}
            disabled={isPending}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              inWatchlist
                ? "bg-emerald-700 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {isPending ? "..." : inWatchlist ? "− 관심종목" : "+ 관심종목"}
          </button>
          <button onClick={onClose} className="hidden lg:block text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
      </div>

      {latest && (
        <div className="flex gap-4 mb-3 text-sm">
          <div>
            <span className="text-gray-400">종가 </span>
            <span className="text-white font-semibold">{formatKRW(latest.close)}</span>
          </div>
          {latest.ma20 && (
            <div>
              <span className="text-gray-400">MA20 </span>
              <span className="text-green-400">{latest.ma20.toFixed(0)}</span>
            </div>
          )}
          {latest.volume_ratio && latest.volume_ratio >= 1.5 && (
            <div>
              <span className="text-gray-400">거래량비율 </span>
              <span className="text-orange-400">{latest.volume_ratio.toFixed(1)}x</span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">차트 로딩 중...</div>
      ) : history.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>
      ) : (
        <LivePriceChart history={history} />
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  LineSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type SeriesType, type Time,
} from "lightweight-charts";

function LivePriceChart({ history }: { history: PriceSnapshot[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const volRef   = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs   = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#131722" }, textColor: "#B2B5BE", fontSize: 10 },
      grid: { vertLines: { color: "#1E2029", style: LineStyle.Solid }, horzLines: { color: "#1E2029", style: LineStyle.Solid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2B2B43" },
      timeScale: { borderColor: "#2B2B43", timeVisible: false },
      width: containerRef.current.offsetWidth,
      height: 220,
    });
    chartRef.current = chart;

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volRef.current = vol;

    lineRef.current = chart.addSeries(LineSeries, { color: "#60A5FA", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });

    const maConfig = [
      { key: "ma20",  color: "#F59E0B" },
      { key: "ma60",  color: "#34D399" },
      { key: "ma120", color: "#22D3EE" },
    ];
    maConfig.forEach(({ key, color }) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      maRefs.current.set(key, s);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.offsetWidth, 220);
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    if (!history.length || !chartRef.current) return;
    const toTime = (d: string) => d.slice(0, 10) as Time;

    lineRef.current?.setData(history.map((p) => ({ time: toTime(p.date), value: p.close })));
    volRef.current?.setData(history.map((p) => ({
      time: toTime(p.date), value: p.volume,
      color: p.close >= (p.open ?? p.close) ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
    })));

    const maKeys = ["ma20", "ma60", "ma120"] as const;
    maKeys.forEach((key) => {
      const s = maRefs.current.get(key);
      if (!s) return;
      const d = history.filter((p) => p[key] != null).map((p) => ({ time: toTime(p.date), value: p[key]! }));
      (s as ISeriesApi<"Line">).setData(d);
    });

    chartRef.current.timeScale().fitContent();
  }, [history]);

  return <div ref={containerRef} style={{ height: 220 }} />;
}

