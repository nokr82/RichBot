"use client";
import { useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCoins, useAddCoin, useDeleteCoin, useCoinInfo, useCoinChart } from "@/hooks/useCoin";
import CoinPriceChart from "@/components/charts/CoinPriceChart";
import CoinAICommentaryCard from "@/components/ai/CoinAICommentaryCard";

function formatCoinPrice(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

export default function CoinDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const router = useRouter();

  const { data: info }           = useCoinInfo(ticker);
  const { data: watchlist = [] } = useCoins();
  const { data: chart = [] }     = useCoinChart(ticker, "day");
  const addMutation    = useAddCoin();
  const deleteMutation = useDeleteCoin();

  const watchlistCoin = useMemo(() => watchlist.find((c) => c.ticker === ticker) ?? null, [watchlist, ticker]);
  const isInWatchlist = !!watchlistCoin?.is_active;
  const coinName      = watchlistCoin?.name ?? info?.name ?? ticker;
  const latest        = chart.length > 0 ? chart[chart.length - 1] : null;

  const currentIndex = watchlist.findIndex((c) => c.ticker === ticker);
  const prevCoin     = currentIndex > 0 ? watchlist[currentIndex - 1] : null;
  const nextCoin     = currentIndex >= 0 && currentIndex < watchlist.length - 1 ? watchlist[currentIndex + 1] : null;

  const goTo = useCallback((t: string) => router.push(`/coins/${t}`), [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft"  && prevCoin) goTo(prevCoin.ticker);
      if (e.key === "ArrowRight" && nextCoin) goTo(nextCoin.ticker);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevCoin, nextCoin, goTo]);

  const toggleWatchlist = () => {
    if (isInWatchlist) {
      deleteMutation.mutate(ticker);
    } else {
      addMutation.mutate({ ticker, name: coinName });
    }
  };
  const isToggling = addMutation.isPending || deleteMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors text-sm px-3 py-1.5 bg-gray-800 rounded-lg flex-shrink-0"
        >
          ← 뒤로
        </button>
        {watchlist.length > 1 && currentIndex >= 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevCoin && goTo(prevCoin.ticker)}
              disabled={!prevCoin}
              title={prevCoin ? `이전: ${prevCoin.name}` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              <span className="text-lg leading-none">‹</span>
              {prevCoin && <span className="hidden sm:inline max-w-[8rem] truncate">{prevCoin.name}</span>}
            </button>
            <span className="text-xs text-gray-500 px-1">{currentIndex + 1} / {watchlist.length}</span>
            <button
              onClick={() => nextCoin && goTo(nextCoin.ticker)}
              disabled={!nextCoin}
              title={nextCoin ? `다음: ${nextCoin.name}` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              {nextCoin && <span className="hidden sm:inline max-w-[8rem] truncate">{nextCoin.name}</span>}
              <span className="text-lg leading-none">›</span>
            </button>
          </div>
        )}
      </div>

      {/* 코인 정보 카드 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{coinName}</h1>
              <span className="text-gray-400 text-lg">{ticker.replace("KRW-", "")}</span>
              <span className="text-xs text-yellow-400 bg-yellow-900/40 px-2 py-0.5 rounded">업비트</span>
            </div>
            {latest && (
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-bold text-white">{formatCoinPrice(latest.close)} KRW</span>
                <span className="text-sm text-gray-400">
                  거래량 {latest.volume >= 1_000 ? `${(latest.volume / 1_000).toFixed(1)}K` : latest.volume.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {latest?.volume_ratio && latest.volume_ratio >= 2 && (
              <span className="text-sm bg-orange-500/20 text-orange-400 px-3 py-1.5 rounded-full font-bold">
                거래량 {latest.volume_ratio.toFixed(1)}배
              </span>
            )}
            <button
              onClick={toggleWatchlist}
              disabled={isToggling}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors ${
                isInWatchlist
                  ? "bg-emerald-700 hover:bg-red-700/80 text-white"
                  : "bg-gray-700 hover:bg-emerald-700 text-gray-300 hover:text-white"
              }`}
            >
              {isToggling ? "..." : isInWatchlist ? "★ 관심코인" : "☆ 관심 추가"}
            </button>
          </div>
        </div>
        {latest && (
          <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-400">
            {latest.ma7   != null && <span>MA7   <span className="text-white font-medium">{formatCoinPrice(latest.ma7)}</span></span>}
            {latest.ma25  != null && <span>MA25  <span className="text-white font-medium">{formatCoinPrice(latest.ma25)}</span></span>}
            {latest.ma50  != null && <span>MA50  <span className="text-white font-medium">{formatCoinPrice(latest.ma50)}</span></span>}
            {latest.ma99  != null && <span>MA99  <span className="text-white font-medium">{formatCoinPrice(latest.ma99)}</span></span>}
            {latest.ma200 != null && <span>MA200 <span className="text-white font-medium">{formatCoinPrice(latest.ma200)}</span></span>}
          </div>
        )}
      </div>

      {/* 차트 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">가격 차트</h2>
        <CoinPriceChart ticker={ticker} height={520} />
      </div>

      {/* AI 해설 */}
      {isInWatchlist && (
        <CoinAICommentaryCard ticker={ticker} coinName={coinName} />
      )}
    </div>
  );
}