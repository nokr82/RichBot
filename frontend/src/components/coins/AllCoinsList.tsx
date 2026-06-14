"use client";
import { useState, useMemo } from "react";
import { useAllCoins, useCoins, useAddCoin, useDeleteCoin } from "@/hooks/useCoin";
import CoinPriceChart from "@/components/charts/CoinPriceChart";
import type { CoinSearchResult } from "@/types";

function formatCoinPrice(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

export default function AllCoinsList() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedName, setSelectedName]   = useState<string>("");

  const { data, isLoading } = useAllCoins(query, page);
  const { data: watchlist = [] } = useCoins();
  const addMutation    = useAddCoin();
  const deleteMutation = useDeleteCoin();

  const watchlistSet = useMemo(
    () => new Set(watchlist.map((c) => c.ticker)),
    [watchlist],
  );

  const items  = data?.items  ?? [];
  const total  = data?.total  ?? 0;
  const size   = data?.size   ?? 50;
  const pages  = Math.max(1, Math.ceil(total / size));

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setPage(1);
    setSelectedTicker(null);
  }

  function selectCoin(coin: CoinSearchResult) {
    setSelectedTicker(coin.ticker === selectedTicker ? null : coin.ticker);
    setSelectedName(coin.name);
  }

  function toggleWatchlist(coin: CoinSearchResult) {
    if (watchlistSet.has(coin.ticker)) {
      deleteMutation.mutate(coin.ticker);
    } else {
      addMutation.mutate(coin);
    }
  }

  return (
    <div className="flex gap-4">
      {/* 왼쪽: 목록 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-white shrink-0">전체코인</h1>
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="코인명 또는 심볼 검색..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {total > 0 && (
            <span className="text-gray-400 text-sm shrink-0">{total.toLocaleString()}개</span>
          )}
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-center py-16">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="text-gray-400 text-center py-16">검색 결과 없음</div>
        ) : (
          <>
            <div className="space-y-1">
              {items.map((coin) => {
                const inWatchlist = watchlistSet.has(coin.ticker);
                const isSelected  = selectedTicker === coin.ticker;
                return (
                  <div
                    key={coin.ticker}
                    onClick={() => selectCoin(coin)}
                    className={`flex items-center px-4 py-3 rounded-xl cursor-pointer border transition-colors ${
                      isSelected
                        ? "bg-gray-700 border-blue-500"
                        : "bg-gray-800 border-transparent hover:bg-gray-750"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium">{coin.name}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        {coin.ticker.replace("KRW-", "")}
                      </span>
                    </div>
                    <span className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-3">
                      업비트
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatchlist(coin); }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        inWatchlist
                          ? "bg-blue-600/20 text-blue-400 hover:bg-red-900/30 hover:text-red-400"
                          : "bg-gray-700 text-gray-300 hover:bg-blue-600 hover:text-white"
                      }`}
                    >
                      {inWatchlist ? "★ 관심" : "☆ 추가"}
                    </button>
                    <span className="text-gray-500 text-lg ml-2">›</span>
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-gray-400 text-sm">{page} / {pages}</span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 오른쪽: 차트 패널 */}
      {selectedTicker && (
        <div className="w-[540px] bg-gray-800 rounded-xl p-4 h-fit sticky top-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-white font-semibold">{selectedName}</span>
              <span className="text-gray-400 text-sm ml-2">{selectedTicker}</span>
            </div>
            <button
              onClick={() => setSelectedTicker(null)}
              className="text-gray-400 hover:text-white text-lg"
            >
              ✕
            </button>
          </div>
          <CoinPriceChart ticker={selectedTicker} height={320} />
        </div>
      )}
    </div>
  );
}
