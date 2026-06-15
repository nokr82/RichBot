"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Disclosure } from "@/types";

export default function DisclosureFeed() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const { data: disclosures = [], isLoading } = useQuery<Disclosure[]>({
    queryKey: ["disclosures"],
    queryFn: () => api.get("/api/disclosures").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.post("/api/disclosures/refresh");
      await queryClient.invalidateQueries({ queryKey: ["disclosures"] });
    } catch {
      setRefreshError("공시 수집에 실패했습니다. DART API 키를 확인하세요.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">공시 정보</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? "수집 중…" : "↻ 새로고침"}
        </button>
      </div>

      {refreshError && (
        <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
          {refreshError}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 p-8 text-center">로딩 중...</div>
      ) : disclosures.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          공시 데이터가 없습니다.<br />
          <span className="text-sm">DART API 키가 설정되어 있다면 위 새로고침 버튼을 눌러 즉시 수집하세요.</span>
        </p>
      ) : (
        disclosures.map((d) => (
          <div key={d.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">{d.corp_name}</span>
                  <span className="text-gray-400 text-sm">{d.rcept_dt}</span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{d.report_nm}</p>
                {d.summary && (
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-300 text-sm leading-relaxed">{d.summary}</p>
                  </div>
                )}
              </div>
              {d.raw_url && (
                <a
                  href={d.raw_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  원문 보기 →
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
