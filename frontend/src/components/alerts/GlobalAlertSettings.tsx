"use client";
import { useState, useEffect } from "react";
import { useGlobalAlertSetting, useUpdateGlobalAlertSetting } from "@/hooks/useAlerts";

const ALL_PAIRS = [
  { key: "5_20",   label: "MA5 / MA20",   trust: "낮음",    color: "text-gray-400",   desc: "신호 빠르지만 휩쏘 많음" },
  { key: "5_60",   label: "MA5 / MA60",   trust: "낮음",    color: "text-gray-400",   desc: "단기 추세 확인용" },
  { key: "20_60",  label: "MA20 / MA60",  trust: "중간",    color: "text-yellow-400", desc: "스윙 매매에 많이 사용" },
  { key: "20_120", label: "MA20 / MA120", trust: "높음",    color: "text-orange-400", desc: "중장기 추세 확인" },
  { key: "50_200", label: "MA50 / MA200", trust: "매우 높음", color: "text-emerald-400", desc: "세계적으로 가장 유명한 골든크로스" },
  { key: "60_240", label: "MA60 / MA240", trust: "매우 높음", color: "text-emerald-400", desc: "국내 장기 투자자 선호" },
];

export default function GlobalAlertSettings() {
  const { data, isLoading } = useGlobalAlertSetting();
  const update = useUpdateGlobalAlertSetting();

  const [pairs, setPairs]             = useState<string[]>(["20_60"]);
  const [volumeSpike, setVolumeSpike] = useState(false);
  const [threshold, setThreshold]     = useState(3.0);
  const [dirty, setDirty]             = useState(false);

  useEffect(() => {
    if (!data) return;
    setPairs(data.enabled_pairs);
    setVolumeSpike(data.volume_spike);
    setThreshold(data.volume_threshold);
    setDirty(false);
  }, [data]);

  const togglePair = (key: string) => {
    setPairs((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
    setDirty(true);
  };

  const save = () => {
    update.mutate(
      { enabled_pairs: pairs, volume_spike: volumeSpike, volume_threshold: threshold },
      { onSuccess: () => setDirty(false) }
    );
  };

  if (isLoading) return null;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">전역 알림 설정</h2>
          <p className="text-xs text-gray-400 mt-0.5">전체 KRX 종목 대상 — 매일 16:00 자동 수집 / 수동 수집 공통 적용</p>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={update.isPending}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {update.isPending ? "저장 중..." : "저장"}
          </button>
        )}
      </div>

      {/* 크로스 페어 선택 */}
      <div>
        <p className="text-xs text-gray-400 mb-2">감지할 크로스</p>
        <div className="space-y-1">
          {ALL_PAIRS.map(({ key, label, trust, color, desc }) => {
            const on = pairs.includes(key);
            return (
              <button
                key={key}
                onClick={() => togglePair(key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                  on
                    ? "bg-indigo-600/20 border-indigo-500/60 text-white"
                    : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-gray-700/30"
                }`}
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                  on ? "bg-indigo-500 border-indigo-500" : "border-gray-500"
                }`}>
                  {on && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor"><path d="M1.5 5.5l2.5 2.5 4.5-5"/></svg>}
                </span>
                <span className="text-sm font-medium w-28 flex-shrink-0">{label}</span>
                <span className={`text-xs font-semibold w-20 flex-shrink-0 ${color}`}>{trust}</span>
                <span className="text-xs text-gray-400 truncate">{desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 거래량 급증 */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => { setVolumeSpike((v) => !v); setDirty(true); }}
            className={`relative w-9 h-5 rounded-full transition-colors ${volumeSpike ? "bg-blue-600" : "bg-gray-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${volumeSpike ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-gray-300">거래량 급증</span>
        </label>
        {volumeSpike && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">임계값</span>
            <input
              type="number"
              min={1.5}
              max={10}
              step={0.5}
              value={threshold}
              onChange={(e) => { setThreshold(Number(e.target.value)); setDirty(true); }}
              className="w-16 px-2 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-white text-center"
            />
            <span className="text-xs text-gray-400">배</span>
          </div>
        )}
      </div>
    </div>
  );
}