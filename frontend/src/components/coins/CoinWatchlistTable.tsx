"use client";
import { useState } from "react";
import { useCoins, useDeleteCoin } from "@/hooks/useCoin";
import CoinSearchModal from "./CoinSearchModal";
import CoinAlertSettingsPanel from "./CoinAlertSettingsPanel";
import CoinPriceChart from "@/components/charts/CoinPriceChart";
import type { Coin } from "@/types";

function formatCoinPrice(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

export default function CoinWatchlistTable() {
  const { data: coins = [], isLoading } = useCoins();
  const deleteMutation = useDeleteCoin();
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">관심코인</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + 코인 추가
          </button>
        </div>

        {coins.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <p className="text-lg mb-2">관심코인이 없습니다.</p>
            <p className="text-sm">상단 버튼으로 코인을 추가하세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {coins.map((coin) => (
              <CoinRow
                key={coin.ticker}
                coin={coin}
                selected={selectedTicker === coin.ticker}
                showSettings={showSettings === coin.ticker}
                onSelect={() => setSelectedTicker(selectedTicker === coin.ticker ? null : coin.ticker)}
                onToggleSettings={() =>
                  setShowSettings(showSettings === coin.ticker ? null : coin.ticker)
                }
                onDelete={() => deleteMutation.mutate(coin.ticker)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedTicker && (
        <CoinDetailPanel
          ticker={selectedTicker}
          name={coins.find((c) => c.ticker === selectedTicker)?.name ?? selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}

      {showModal && <CoinSearchModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function CoinRow({
  coin, selected, showSettings, onSelect, onToggleSettings, onDelete,
}: {
  coin: Coin;
  selected: boolean;
  showSettings: boolean;
  onSelect: () => void;
  onToggleSettings: () => void;
  onDelete: () => void;
}) {
  const p = coin.latest_price;

  return (
    <div className={`bg-gray-800 rounded-xl overflow-hidden border ${selected ? "border-blue-500" : "border-transparent"}`}>
      <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-750 gap-4" onClick={onSelect}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{coin.name}</span>
            <span className="text-gray-400 text-sm">{coin.ticker.replace("KRW-", "")}</span>
            <span className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">업비트</span>
          </div>
        </div>
        <div className="text-right">
          {p ? (
            <>
              <div className="text-white font-bold">{formatCoinPrice(p.close)} KRW</div>
              <div className="text-xs text-gray-400">거래량 {p.volume.toLocaleString()}</div>
            </>
          ) : (
            <span className="text-gray-500 text-sm">가격 없음</span>
          )}
        </div>
        {(p?.ma7 || p?.ma25) && (
          <div className="hidden md:flex gap-3 text-xs text-gray-400">
            {p?.ma7 && <span>MA7 <span className="text-white">{p.ma7.toFixed(0)}</span></span>}
            {p?.ma25 && <span>MA25 <span className="text-white">{p.ma25.toFixed(0)}</span></span>}
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
        >⚙</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-gray-500 hover:text-red-400 text-sm ml-1"
        >삭제</button>
        <span className="text-gray-400 text-lg">›</span>
      </div>

      {showSettings && (
        <div className="border-t border-gray-700 p-4">
          <CoinAlertSettingsPanel ticker={coin.ticker} />
        </div>
      )}
    </div>
  );
}

function CoinDetailPanel({ ticker, name, onClose }: { ticker: string; name: string; onClose: () => void }) {
  return (
    <div className="w-[520px] bg-gray-800 rounded-xl p-4 h-fit sticky top-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="text-white font-semibold">{name}</span>
          <span className="text-gray-400 text-sm ml-2">{ticker}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
      </div>
      <CoinPriceChart ticker={ticker} height={300} />
    </div>
  );
}
