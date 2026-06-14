"use client";
import { useState } from "react";
import { useSearchCoins, useAddCoin } from "@/hooks/useCoin";

export default function CoinSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { data: results = [], isLoading } = useSearchCoins(query);
  const addMutation = useAddCoin();

  const handleAdd = async (coin: { ticker: string; name: string }) => {
    await addMutation.mutateAsync({ ticker: coin.ticker, name: coin.name });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-white font-semibold text-lg">코인 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            type="text"
            placeholder="코인명 또는 심볼 검색 (예: 비트코인, BTC)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="max-h-72 overflow-y-auto px-4 pb-4 space-y-1">
          {isLoading && <p className="text-gray-400 text-sm text-center py-4">검색 중...</p>}
          {!isLoading && query && results.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">검색 결과가 없습니다.</p>
          )}
          {results.map((coin) => (
            <button
              key={coin.ticker}
              onClick={() => handleAdd(coin)}
              disabled={addMutation.isPending}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <span className="text-white font-medium">{coin.name}</span>
              <span className="text-gray-400 text-sm ml-2">{coin.ticker}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
