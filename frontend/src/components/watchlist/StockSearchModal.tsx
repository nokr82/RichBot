"use client";
import { useState, useCallback } from "react";
import { useSearchStocks, useAddStock } from "@/hooks/useWatchlist";
import type { StockSearchResult } from "@/types";

interface Props {
  onClose: () => void;
}

export default function StockSearchModal({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const { data: results = [], isFetching } = useSearchStocks(query);
  const addMutation = useAddStock();

  async function handleAdd(stock: StockSearchResult) {
    await addMutation.mutateAsync(stock);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">종목 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <input
          autoFocus
          className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          placeholder="종목명 또는 종목코드 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && <p className="text-gray-400 text-sm mb-2">검색 중...</p>}
        <ul className="space-y-1 max-h-60 overflow-y-auto">
          {results.map((r) => (
            <li key={r.ticker} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-700">
              <div>
                <span className="text-white font-medium">{r.name}</span>
                <span className="ml-2 text-gray-400 text-sm">{r.ticker}</span>
                <span className="ml-2 text-xs text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">{r.market}</span>
              </div>
              <button
                onClick={() => handleAdd(r)}
                disabled={addMutation.isPending}
                className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg disabled:opacity-50"
              >
                추가
              </button>
            </li>
          ))}
          {query.length > 0 && !isFetching && results.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">검색 결과가 없습니다.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
