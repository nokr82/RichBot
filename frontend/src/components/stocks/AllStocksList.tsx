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

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

function LivePriceChart({ history }: { history: PriceSnapshot[] }) {
  const chartData = history.map((p) => ({
    date: p.date.slice(5, 10),
    close: p.close,
    volume: p.volume,
    MA20: p.ma20 ?? undefined,
    MA60: p.ma60 ?? undefined,
    MA120: p.ma120 ?? undefined,
  }));
  const prices = history.map((p) => p.close);
  const minP = Math.min(...prices) * 0.98;
  const maxP = Math.max(...prices) * 1.02;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[minP, maxP]} tick={{ fill: "#9CA3AF", fontSize: 10 }}
          tickFormatter={(v: number) => (v / 1000).toFixed(0) + "K"} />
        <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#F9FAFB" }} />
        <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 11 }} />
        <Bar dataKey="volume" fill="#4B5563" opacity={0.4} name="거래량" />
        <Line type="monotone" dataKey="close" stroke="#60A5FA" dot={false} strokeWidth={2} name="종가" />
        <Line type="monotone" dataKey="MA20"  stroke="#F59E0B" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="MA20" />
        <Line type="monotone" dataKey="MA60"  stroke="#34D399" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="MA60" />
        <Line type="monotone" dataKey="MA120" stroke="#22D3EE" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="MA120" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
