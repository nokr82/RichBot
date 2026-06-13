"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStocks } from "@/hooks/useWatchlist";
import PriceChart from "@/components/charts/PriceChart";
import AICommentaryCard from "@/components/ai/AICommentaryCard";
import AlertSettingsPanel from "@/components/alerts/AlertSettingsPanel";
import { formatKRW, formatVolume } from "@/lib/formatters";

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const router = useRouter();
  const { data: stocks = [] } = useStocks();
  const [showSettings, setShowSettings] = useState(false);

  const currentIndex = stocks.findIndex((s) => s.ticker === ticker);
  const prevStock = currentIndex > 0 ? stocks[currentIndex - 1] : null;
  const nextStock = currentIndex >= 0 && currentIndex < stocks.length - 1 ? stocks[currentIndex + 1] : null;

  const goTo = useCallback(
    (t: string) => router.push(`/stocks/${t}`),
    [router]
  );

  // 키보드 방향키 지원
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevStock) goTo(prevStock.ticker);
      if (e.key === "ArrowRight" && nextStock) goTo(nextStock.ticker);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevStock, nextStock, goTo]);

  const stock = stocks[currentIndex] ?? null;
  const p = stock?.latest_price;

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

        {stocks.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevStock && goTo(prevStock.ticker)}
              disabled={!prevStock}
              title={prevStock ? `이전: ${prevStock.name}` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              <span className="text-lg leading-none">‹</span>
              {prevStock && (
                <span className="hidden sm:inline max-w-[8rem] truncate">{prevStock.name}</span>
              )}
            </button>

            <span className="text-xs text-gray-500 px-1 flex-shrink-0">
              {currentIndex + 1} / {stocks.length}
            </span>

            <button
              onClick={() => nextStock && goTo(nextStock.ticker)}
              disabled={!nextStock}
              title={nextStock ? `다음: ${nextStock.name}` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              {nextStock && (
                <span className="hidden sm:inline max-w-[8rem] truncate">{nextStock.name}</span>
              )}
              <span className="text-lg leading-none">›</span>
            </button>
          </div>
        )}
      </div>

      {/* 종목 정보 카드 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{stock?.name ?? ticker}</h1>
              <span className="text-gray-400 text-lg">{ticker}</span>
              {stock?.market && (
                <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">
                  {stock.market}
                </span>
              )}
            </div>
            {p && (
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-bold text-white">{formatKRW(p.close)}</span>
                <span className="text-sm text-gray-400">거래량 {formatVolume(p.volume)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {p?.volume_ratio && p.volume_ratio >= 2 && (
              <span className="text-sm bg-orange-500/20 text-orange-400 px-3 py-1.5 rounded-full font-bold">
                거래량 {p.volume_ratio.toFixed(1)}배
              </span>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                showSettings
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              ⚙ 알림 설정
            </button>
          </div>
        </div>

        {p && (
          <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-400">
            {p.ma20 != null && (
              <span>MA20 <span className="text-white font-medium">{p.ma20.toFixed(0)}</span></span>
            )}
            {p.ma60 != null && (
              <span>MA60 <span className="text-white font-medium">{p.ma60.toFixed(0)}</span></span>
            )}
            {p.ma120 != null && (
              <span>MA120 <span className="text-white font-medium">{p.ma120.toFixed(0)}</span></span>
            )}
            {p.ma200 != null && (
              <span>MA200 <span className="text-white font-medium">{p.ma200.toFixed(0)}</span></span>
            )}
          </div>
        )}
      </div>

      {showSettings && (
        <div className="bg-gray-800 rounded-xl p-6">
          <AlertSettingsPanel ticker={ticker} />
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">가격 차트</h2>
        <PriceChart ticker={ticker} height={520} />
      </div>

      {stock && (
        <div className="bg-gray-800 rounded-xl p-6">
          <AICommentaryCard ticker={ticker} stockName={stock.name} />
        </div>
      )}
    </div>
  );
}