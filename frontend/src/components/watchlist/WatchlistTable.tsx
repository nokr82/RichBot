"use client";
import { useState } from "react";
import { useStocks, useDeleteStock } from "@/hooks/useWatchlist";
import StockSearchModal from "./StockSearchModal";
import PriceChart from "@/components/charts/PriceChart";
import AICommentaryCard from "@/components/ai/AICommentaryCard";
import AlertSettingsPanel from "@/components/alerts/AlertSettingsPanel";
import { formatKRW, formatVolume } from "@/lib/formatters";
import type { Stock } from "@/types";

export default function WatchlistTable() {
  const { data: stocks = [], isLoading } = useStocks();
  const deleteMutation = useDeleteStock();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<string | null>(null);

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">관심종목</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 종목 추가
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="text-lg mb-2">관심종목이 없습니다.</p>
          <p className="text-sm">상단 버튼으로 종목을 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stocks.map((stock) => (
            <StockRow
              key={stock.ticker}
              stock={stock}
              expanded={expanded === stock.ticker}
              showSettings={showSettings === stock.ticker}
              onExpand={() => setExpanded(expanded === stock.ticker ? null : stock.ticker)}
              onToggleSettings={() =>
                setShowSettings(showSettings === stock.ticker ? null : stock.ticker)
              }
              onDelete={() => deleteMutation.mutate(stock.ticker)}
            />
          ))}
        </div>
      )}

      {showModal && <StockSearchModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function StockRow({
  stock, expanded, showSettings, onExpand, onToggleSettings, onDelete,
}: {
  stock: Stock;
  expanded: boolean;
  showSettings: boolean;
  onExpand: () => void;
  onToggleSettings: () => void;
  onDelete: () => void;
}) {
  const p = stock.latest_price;
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-750 gap-4"
        onClick={onExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{stock.name}</span>
            <span className="text-gray-400 text-sm">{stock.ticker}</span>
            <span className="text-xs text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">{stock.market}</span>
          </div>
        </div>
        <div className="text-right">
          {p ? (
            <>
              <div className="text-white font-bold">{formatKRW(p.close)}</div>
              <div className="text-xs text-gray-400">거래량 {formatVolume(p.volume)}</div>
            </>
          ) : (
            <span className="text-gray-500 text-sm">가격 없음</span>
          )}
        </div>
        {(p?.ma20 || p?.ma60) && (
          <div className="hidden md:flex gap-3 text-xs text-gray-400">
            <span>MA20 <span className="text-white">{p?.ma20?.toFixed(0) ?? "-"}</span></span>
            <span>MA60 <span className="text-white">{p?.ma60?.toFixed(0) ?? "-"}</span></span>
          </div>
        )}
        {p?.volume_ratio && p.volume_ratio >= 2 && (
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
            거래량 {p.volume_ratio.toFixed(1)}배
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSettings(); }}
          className={`text-sm ml-1 transition-colors ${showSettings ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}
          title="알림 설정"
        >
          ⚙
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-gray-500 hover:text-red-400 text-sm ml-1"
        >
          삭제
        </button>
        <span className="text-gray-500">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          <PriceChart ticker={stock.ticker} />
          {showSettings && <AlertSettingsPanel ticker={stock.ticker} />}
          <AICommentaryCard ticker={stock.ticker} stockName={stock.name} />
        </div>
      )}
    </div>
  );
}
