"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Disclosure } from "@/types";

export default function DisclosureFeed() {
  const { data: disclosures = [], isLoading } = useQuery<Disclosure[]>({
    queryKey: ["disclosures"],
    queryFn: () => api.get("/api/disclosures").then((r) => r.data),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="text-gray-400 p-8 text-center">로딩 중...</div>;

  return (
    <div className="space-y-3">
      {disclosures.length === 0 && (
        <p className="text-gray-500 text-center py-12">공시 데이터가 없습니다. DART API 키를 설정하면 공시가 수집됩니다.</p>
      )}
      {disclosures.map((d) => (
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
      ))}
    </div>
  );
}
