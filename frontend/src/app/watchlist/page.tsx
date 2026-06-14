"use client";
import { useState } from "react";
import WatchlistTable from "@/components/watchlist/WatchlistTable";
import CoinWatchlistTable from "@/components/coins/CoinWatchlistTable";

type Tab = "stocks" | "coins";

export default function WatchlistPage() {
  const [tab, setTab] = useState<Tab>("stocks");

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("stocks")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "stocks" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          주식
        </button>
        <button
          onClick={() => setTab("coins")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "coins" ? "bg-yellow-500 text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          코인
        </button>
      </div>
      {tab === "stocks" ? <WatchlistTable /> : <CoinWatchlistTable />}
    </div>
  );
}
