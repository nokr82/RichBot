"use client";
import { useAlerts, useMarkRead } from "@/hooks/useAlerts";
import AlertBadge from "./AlertBadge";
import { formatDate } from "@/lib/formatters";

export default function AlertList() {
  const { data, isLoading } = useAlerts();
  const markRead = useMarkRead();

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  const crossEvents = data?.cross_events ?? [];
  const volSpikes = data?.volume_spikes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">알림</h1>
        <button
          onClick={() => markRead.mutate({ all: true })}
          className="text-sm text-gray-400 hover:text-white"
        >
          전체 읽음
        </button>
      </div>

      {crossEvents.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">크로스 이벤트</h2>
          <div className="space-y-2">
            {crossEvents.map((e) => (
              <div key={e.id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
                <AlertBadge eventType={e.event_type} />
                <div className="flex-1">
                  <p className="text-white text-sm">
                    단기 <span className="font-bold">{e.short_val.toLocaleString("ko-KR")}</span> /
                    장기 <span className="font-bold">{e.long_val.toLocaleString("ko-KR")}</span>
                  </p>
                </div>
                <span className="text-gray-400 text-xs">{formatDate(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {volSpikes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">거래량 급증</h2>
          <div className="space-y-2">
            {volSpikes.map((e) => (
              <div key={e.id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                  거래량 {e.ratio.toFixed(1)}배
                </span>
                <p className="text-gray-400 text-sm flex-1">임계값 {e.threshold}배 초과</p>
                <span className="text-gray-400 text-xs">{e.date}</span>
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
