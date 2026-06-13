"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAlerts, useMarkRead, useManualScan } from "@/hooks/useAlerts";
import AlertBadge from "./AlertBadge";
import GlobalAlertSettings from "./GlobalAlertSettings";
import { formatDate } from "@/lib/formatters";

function MarketBadge({ market }: { market?: string | null }) {
  if (!market) return null;
  const isKospi = market === "KOSPI" || market === "STK";
  const isKosdaq = market === "KOSDAQ" || market === "KSQ";
  if (!isKospi && !isKosdaq) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
      isKospi ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
    }`}>
      {isKospi ? "KOSPI" : "KOSDAQ"}
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

const PAIR_LABELS: Record<string, string> = {
  "5_20": "5/20", "5_60": "5/60",
  "20_60": "20/60", "20_120": "20/120",
  "50_200": "50/200", "60_240": "60/240",
};

export default function AlertList() {
  const router = useRouter();
  const { data, isLoading } = useAlerts();
  const markRead = useMarkRead();
  const scan = useManualScan();

  const [dirFilter, setDirFilter] = useState<"ALL" | "GOLDEN" | "DEAD">("ALL");
  const [pairFilter, setPairFilter] = useState<string>("ALL");

  const crossEvents = data?.cross_events ?? [];
  const volSpikes   = data?.volume_spikes ?? [];

  // 현재 데이터에 존재하는 페어만 필터 버튼 노출
  const availablePairs = useMemo(() => {
    const keys = new Set<string>();
    crossEvents.forEach((e) => {
      const parts = e.event_type.split("_");
      // GOLDEN_20_60 → pair key = "20_60"
      if (parts.length >= 3) keys.add(parts.slice(1).join("_"));
    });
    return Array.from(keys).sort();
  }, [crossEvents]);

  const filtered = useMemo(() => crossEvents.filter((e) => {
    const isGolden = e.event_type.startsWith("GOLDEN");
    if (dirFilter === "GOLDEN" && !isGolden) return false;
    if (dirFilter === "DEAD"   &&  isGolden) return false;
    if (pairFilter !== "ALL") {
      const parts = e.event_type.split("_");
      const pair  = parts.slice(1).join("_");
      if (pair !== pairFilter) return false;
    }
    return true;
  }), [crossEvents, dirFilter, pairFilter]);

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">알림</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {scan.isPending ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                수집 중...
              </>
            ) : "크로스 수집"}
          </button>
          <button onClick={() => markRead.mutate({ all: true })} className="text-sm text-gray-400 hover:text-white">
            전체 읽음
          </button>
        </div>
      </div>

      <GlobalAlertSettings />

      {/* 크로스 이벤트 */}
      {crossEvents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-300">
              크로스 이벤트
              {filtered.length !== crossEvents.length && (
                <span className="ml-2 text-sm font-normal text-gray-500">{filtered.length} / {crossEvents.length}</span>
              )}
            </h2>
          </div>

          {/* 필터 바 */}
          <div className="flex flex-wrap gap-2">
            {/* 방향 */}
            <div className="flex gap-1">
              <FilterBtn active={dirFilter === "ALL"}    onClick={() => setDirFilter("ALL")}>전체</FilterBtn>
              <FilterBtn active={dirFilter === "GOLDEN"} onClick={() => setDirFilter("GOLDEN")}>▲ 골든</FilterBtn>
              <FilterBtn active={dirFilter === "DEAD"}   onClick={() => setDirFilter("DEAD")}>▼ 데드</FilterBtn>
            </div>

            {/* 구분선 */}
            {availablePairs.length > 0 && <div className="w-px bg-gray-700 self-stretch" />}

            {/* MA 페어 */}
            {availablePairs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <FilterBtn active={pairFilter === "ALL"} onClick={() => setPairFilter("ALL")}>전체</FilterBtn>
                {availablePairs.map((p) => (
                  <FilterBtn key={p} active={pairFilter === p} onClick={() => setPairFilter(p)}>
                    MA{PAIR_LABELS[p] ?? p.replace("_", "/")}
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
                onClick={() => e.ticker && router.push(`/stocks/${e.ticker}`)}
                className={`bg-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors ${e.ticker ? "cursor-pointer hover:bg-gray-700" : ""}`}
              >
                <AlertBadge eventType={e.event_type} />
                <div className="flex-1 min-w-0">
                  {e.stock_name && (
                    <p className="text-white text-sm font-semibold truncate">
                      {e.stock_name}
                      {e.ticker && <span className="text-gray-400 font-normal ml-1.5 text-xs">{e.ticker}</span>}
                    </p>
                  )}
                  <p className="text-gray-400 text-xs">
                    단기 <span className="text-white">{e.short_val.toLocaleString("ko-KR")}</span>
                    {" / "}
                    장기 <span className="text-white">{e.long_val.toLocaleString("ko-KR")}</span>
                  </p>
                </div>
                <MarketBadge market={e.market} />
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
                onClick={() => e.ticker && router.push(`/stocks/${e.ticker}`)}
                className={`bg-gray-800 rounded-xl p-4 flex items-center gap-3 transition-colors ${e.ticker ? "cursor-pointer hover:bg-gray-700" : ""}`}
              >
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                  {e.ratio.toFixed(1)}배
                </span>
                <div className="flex-1 min-w-0">
                  {e.stock_name && (
                    <p className="text-white text-sm font-semibold truncate">
                      {e.stock_name}
                      {e.ticker && <span className="text-gray-400 font-normal ml-1.5 text-xs">{e.ticker}</span>}
                    </p>
                  )}
                  <p className="text-gray-400 text-xs">임계값 {e.threshold}배 초과</p>
                </div>
                <MarketBadge market={e.market} />
                <span className="text-gray-400 text-xs whitespace-nowrap">{e.date}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {crossEvents.length === 0 && volSpikes.length === 0 && (
        <p className="text-center text-gray-500 py-12">알림이 없습니다.</p>
      )}
    </div>
  );
}