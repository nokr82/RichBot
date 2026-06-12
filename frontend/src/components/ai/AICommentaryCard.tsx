"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AiCommentary } from "@/types";

interface Props {
  ticker: string;
  stockName: string;
}

export default function AICommentaryCard({ ticker, stockName }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: commentary, isLoading } = useQuery<AiCommentary | null>({
    queryKey: ["ai-commentary", ticker, today],
    queryFn: () => api.get(`/api/ai/commentary/${ticker}`, { params: { target_date: today } }).then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/api/ai/commentary/${ticker}/generate`, null, { params: { target_date: today } }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-commentary", ticker, today] }),
  });

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">AI 해설 — {stockName}</h3>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded-lg disabled:opacity-50"
        >
          {generateMutation.isPending ? "생성 중..." : "AI 해설 생성"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm">로딩 중...</div>
      ) : commentary ? (
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{commentary.commentary}</p>
      ) : (
        <p className="text-gray-500 text-sm">해설이 없습니다. 상단 버튼으로 생성하세요.</p>
      )}
    </div>
  );
}
