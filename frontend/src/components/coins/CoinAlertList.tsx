"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCoinAlerts, useMarkCoinRead, useManualCoinScan } from "@/hooks/useCoin";
import { formatDate } from "@/lib/formatters";
import type { CoinCrossEvent, CoinVolumeSpikeEvent } from "@/types";

const COIN_PAIR_LABELS: Record<string, string> = {
  "7_25":   "7/25",
  "7_99":   "7/99",
  "25_99":  "25/99",
  "50_200": "50/200",
};

function CoinAlertBadge({ eventType }: { eventType: string }) {
  const isGolden = eventType.startsWith("GOLDEN");
  const raw  = eventType.replace(/^(GOLDEN|DEAD)_/, "");
  const pair = COIN_PAIR_LABELS[raw] ?? raw.replace("_", "/");
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
      isGolden ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
    }`}>
      {isGolden ? "골든" : "데드"} MA{pair}
    </span>
  );
}

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-all whitespace-nowrap ${
        active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function CoinAlertList() {
  const router = useRouter();
  const [page, setPage]             = useState(1);
  const [dirFilter, setDirFilter]   = useState<"ALL" | "GOLDEN" | "DEAD">("ALL");
  const [pairFilter, setPairFilter] = useState<string>("ALL");

  const { data, isLoading } = useCoinAlerts(page);
  const markRead   = useMarkCoinRead();
  const manualScan = useManualCoinScan();

  const crossEvents: CoinCrossEvent[]       = data?.cross_events ?? [];
  const volSpikes:   CoinVolumeSpikeEvent[] = data?.volume_spikes ?? [];
  const PAGE_SIZE = 20;
  const isLastPage = crossEvents.length < PAGE_SIZE && volSpikes.length < PAGE_SIZE;

  const availablePairs = useMemo(() => {
    const keys = new Set<string>();
    crossEvents.forEach((e) => {
      const raw = e.event_type.replace(/^(GOLDEN|DEAD)_/, "");
      if (raw) keys.add(raw);
    });
    return Array.from(keys).sort();
  }, [crossEvents]);

  const filtered = useMemo(() => crossEvents.filter((e) => {
    const isGolden = e.event_type.startsWith("GOLDEN");
    if (dirFilter === "GOLDEN" && !isGolden) return false;
    if (dirFilter === "DEAD"   &&  isGolden) return false;
    if (pairFilter !== "ALL") {
      const raw = e.event_type.replace(/^(GOLDEN|DEAD)_/, "");
      if (raw !== pairFilter) return false;
    }
    return true;
  }), [crossEvents, dirFilter, pairFilter]);

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">코인알림</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => manualScan.mutate()}
            disabled={manualScan.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {manualScan.isPending ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                수집 중...
              </>
            ) : "크로스 수집"}
          </button>
          <button
            onClick={() => markRead.mutate({ all: true })}
            className="text-sm text-gray-400 hover:text-white"
          >
            전체 읽음
          </button>
        </div>
      </div>

      {/* 크로스 이벤트 */}
      {crossEvents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-300">
              크로스 이벤트
              {filtered.length !== crossEvents.length && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {filtered.length} / {crossEvents.length}
                </span>
              )}
            </h2>
          </div>

          {/* 필터 바 */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              <FilterBtn active={dirFilter === "ALL"}    onClick={() => setDirFilter("ALL")}>전체</FilterBtn>
              <FilterBtn active={dirFilter === "GOLDEN"} onClick={() => setDirFilter("GOLDEN")}>▲ 골든</FilterBtn>
              <FilterBtn active={dirFilter === "DEAD"}   onClick={() => setDirFilter("DEAD")}>▼ 데드</FilterBtn>
            </div>
            {availablePairs.length > 0 && <div className="w-px bg-gray-700 self-stretch" />}
            {availablePairs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <FilterBtn active={pairFilter === "ALL"} onClick={() => setPairFilter("ALL")}>전체</FilterBtn>
                {availablePairs.map((raw) => (
                  <FilterBtn key={raw} active={pairFilter === raw} onClick={() => setPairFilter(raw)}>
                    MA{COIN_PAIR_LABELS[raw] ?? raw.replace("_", "/")}
                  </FilterBtn>
                ))}
              </div>
            )}
          </div>

          {/* 목록 */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">조건에 맞는 알림 없음</p>
            ) : filtered.map((e) => (
              <div
                key={e.id}
                onClick={() => e.ticker && router.push(`/coins/${e.ticker}`)}
                className={`bg-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors ${
                  e.ticker ? "cursor-pointer hover:bg-gray-700" : ""
                } ${!e.notified ? "border-l-2 border-blue-500" : ""}`}
              >
                <CoinAlertBadge eventType={e.event_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {e.coin_name ?? e.ticker}
                    {e.ticker && (
                      <span className="text-gray-400 font-normal ml-1.5 text-xs">
                        {e.ticker.replace("KRW-", "")}
                      </span>
                    )}
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400">업비트</span>
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    단기 <span className="text-white">{e.short_val.toLocaleString("ko-KR")}</span>
                    {" / "}
                    장기 <span className="text-white">{e.long_val.toLocaleString("ko-KR")}</span>
                  </p>
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">{formatDate(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 거래량 급증 */}
      {volSpikes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">거래량 급증</h2>
          <div className="space-y-2">
            {volSpikes.map((e) => (
              <div
                key={e.id}
                onClick={() => e.ticker && router.push(`/coins/${e.ticker}`)}
                className={`bg-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors ${
                  e.ticker ? "cursor-pointer hover:bg-gray-700" : ""
                } ${!e.notified ? "border-l-2 border-orange-500" : ""}`}
              >
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                  {e.ratio.toFixed(1)}배
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    {e.coin_name ?? e.ticker}
                    {e.ticker && (
                      <span className="text-gray-400 font-normal ml-1.5 text-xs">
                        {e.ticker.replace("KRW-", "")}
                      </span>
                    )}
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400">업비트</span>
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">임계값 {e.threshold}배 초과</p>
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">{formatDate(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {crossEvents.length === 0 && volSpikes.length === 0 && (
        <p className="text-center text-gray-500 py-12">
          코인 알림이 없습니다.<br />
          <span className="text-sm">크로스 수집을 실행해 보세요.</span>
        </p>
      )}

      {/* 페이지네이션 */}
      {(crossEvents.length > 0 || volSpikes.length > 0) && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-gray-400 text-sm px-2">{page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={isLastPage}
            className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
