"use client";
import { useAlertSettings, useUpdateAlertSettings } from "@/hooks/useAlerts";

const MA_PAIRS = [
  { id: "20_60",  label: "MA 20/60",  desc: "스윙 매매",          trust: "중간",    color: "text-yellow-400" },
  { id: "20_120", label: "MA 20/120", desc: "중장기 추세",          trust: "높음",    color: "text-green-400"  },
  { id: "50_200", label: "MA 50/200", desc: "세계 표준 골든크로스",  trust: "매우 높음", color: "text-blue-400"   },
  { id: "60_240", label: "MA 60/240", desc: "국내 장기 투자자 선호", trust: "매우 높음", color: "text-purple-400" },
];

interface Props {
  ticker: string;
}

export default function AlertSettingsPanel({ ticker }: Props) {
  const { data: settings, isLoading } = useAlertSettings(ticker);
  const update = useUpdateAlertSettings(ticker);

  if (isLoading || !settings) return null;

  const togglePair = (id: string) => {
    const next = settings.enabled_pairs.includes(id)
      ? settings.enabled_pairs.filter((p) => p !== id)
      : [...settings.enabled_pairs, id];
    update.mutate({ enabled_pairs: next });
  };

  return (
    <div className="bg-gray-800/60 rounded-xl p-4 space-y-3 border border-gray-700/50">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">이평 크로스 알림</h3>

      <div className="grid grid-cols-2 gap-2">
        {MA_PAIRS.map((pair) => {
          const enabled = settings.enabled_pairs.includes(pair.id);
          return (
            <button
              key={pair.id}
              onClick={() => togglePair(pair.id)}
              disabled={update.isPending}
              className={`flex items-start gap-2 p-2.5 rounded-lg text-left transition-all ${
                enabled
                  ? "bg-blue-600/15 border border-blue-500/40"
                  : "bg-gray-700/40 border border-gray-600/30 opacity-60"
              }`}
            >
              <span
                className={`mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  enabled ? "bg-blue-500 text-white" : "bg-gray-600 text-gray-400"
                }`}
              >
                {enabled ? "✓" : ""}
              </span>
              <div className="min-w-0">
                <div className={`text-xs font-bold ${enabled ? pair.color : "text-gray-500"}`}>
                  {pair.label}
                </div>
                <div className="text-xs text-gray-500 leading-tight">{pair.desc}</div>
                <div className="text-xs text-gray-600">신뢰도 {pair.trust}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-700/50">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.volume_spike}
              onChange={(e) => update.mutate({ volume_spike: e.target.checked })}
              className="accent-blue-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-400">거래량 급증</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.push_notify}
              onChange={(e) => update.mutate({ push_notify: e.target.checked })}
              className="accent-blue-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-400">푸시 알림</span>
          </label>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">거래량 임계값</span>
          <input
            type="number"
            value={settings.volume_threshold}
            min={1}
            max={10}
            step={0.5}
            onChange={(e) => update.mutate({ volume_threshold: parseFloat(e.target.value) })}
            className="w-14 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">배</span>
        </label>
      </div>
    </div>
  );
}
