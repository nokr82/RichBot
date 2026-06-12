"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Stock, StockSearchResult } from "@/types";

export function useStocks() {
  return useQuery<Stock[]>({
    queryKey: ["stocks"],
    queryFn: () => api.get("/api/stocks").then((r) => r.data),
    refetchInterval: 15 * 60 * 1000, // 15 min
  });
}

export function useSearchStocks(query: string) {
  return useQuery<StockSearchResult[]>({
    queryKey: ["stock-search", query],
    queryFn: () => api.get("/api/stocks/search", { params: { q: query } }).then((r) => r.data),
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockSearchResult) => api.post("/api/stocks", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => api.delete(`/api/stocks/${ticker}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  });
}
