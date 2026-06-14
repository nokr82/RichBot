"use client";
import { useState, useEffect } from "react";
import { useCoinAlertSettings, useUpdateCoinAlertSettings } from "@/hooks/useCoin";

const COIN_PAIRS = [
  { key: "7_25",   label: "MA 7/25",   desc: "단기 추세" },
  { key: "7_99",   label: "MA 7/99",   desc: "중기 추세" },
  { key: "25_99",  label: "MA 25/99",  desc: "중장기 추세" },
  { key: "50_200", label: "MA 50/200", desc: "장기 (골든크로스)" },
];

export default function CoinAlertSettingsPanel({ ticker }: { ticker: string }) {
  const { data: setting } = useCoinAlertSettings(ticker);
  const updateMutation = useUpdateCoinAlertSettings(ticker);
  const [pairs, setPairs] = useState<string[]>([]);
  const [volSpike, setVolSpike] = useState(true);
  const [threshold, setThreshold] = useState(2.0);
  const [pushNotify, setPushNotify] = useState(true);

  useEffect(() => {
    if (setting) {
      setPairs(setting.enabled_pairs);
      setVolSpike(setting.volume_spike);
      setThreshold(setting.volume_threshold);
      setPushNotify(setting.push_notify);
    }
  }, [setting]);

  const togglePair = (key: string) => {
    setPairs((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const handleSave = () => {
    updateMutation.mutate({ enabled_pairs: pairs, volume_spike: volSpike, volume_threshold: threshold, push_notify: pushNotify });
  };

  if (!setting) return <div className="text-gray-400 text-sm">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-gray-400 text-xs mb-2">이동평균선 교차 알림</p>
        <div className="grid grid-cols-2 gap-2">
          {COIN_PAIRS.map(({ key, label, desc }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pairs.includes(key)}
                onChange={() => togglePair(key)}
                className="accent-blue-500"
              />
              <span className="text-white text-sm">{label}</span>
              <span className="text-gray-500 text-xs">({desc})</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={volSpike} onChange={(e) => setVolSpike(e.target.checked)} className="accent-blue-500" />
          <span className="text-white text-sm">거래량 급증</span>
        </label>
        {volSpike && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">임계값</span>
            <input
              type="number" min={1} max={20} step={0.5} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="bg-gray-700 text-white rounded px-2 py-1 text-sm w-16 outline-none"
            />
            <span className="text-gray-400 text-xs">배</span>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={pushNotify} onChange={(e) => setPushNotify(e.target.checked)} className="accent-blue-500" />
          <span className="text-white text-sm">푸시 알림</span>
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg"
      >
        {updateMutation.isPending ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
