"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { PriceSnapshot } from "@/types";

export type ChartInterval = "15m" | "day" | "week" | "month" | "year";

export function usePriceHistory(ticker: string, days = 90) {
  return useQuery<PriceSnapshot[]>({
    queryKey: ["price-history", ticker, days],
    queryFn: () =>
      api.get(`/api/prices/${ticker}/history`, { params: { days } }).then((r) => r.data),
    enabled: !!ticker,
    refetchInterval: 15 * 60 * 1000,
  });
}

export function useChartData(ticker: string, interval: ChartInterval = "day") {
  return useQuery<PriceSnapshot[]>({
    queryKey: ["chart-data", ticker, interval],
    queryFn: () =>
      api.get(`/api/prices/${ticker}/chart`, { params: { interval } }).then((r) => r.data),
    enabled: !!ticker,
    refetchInterval: interval === "15m" ? 60 * 1000 : 15 * 60 * 1000,
  });
}
