"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Coin, CoinSearchResult, CoinPriceSnapshot, CoinAlertsResponse, CoinAlertSetting, GlobalCoinAlertSetting } from "@/types";

export function useCoins() {
  return useQuery<Coin[]>({
    queryKey: ["coins"],
    queryFn: () => api.get("/api/coins").then((r) => r.data),
    refetchInterval: 60 * 60 * 1000,
  });
}

export function useAllCoins(query: string, page: number, size = 50) {
  return useQuery<{ items: CoinSearchResult[]; total: number; page: number; size: number }>({
    queryKey: ["coins-all", query, page, size],
    queryFn: () =>
      api.get("/api/coins/all", { params: { q: query, page, size } }).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCoinInfo(ticker: string) {
  return useQuery<{ ticker: string; name: string; is_active: boolean }>({
    queryKey: ["coin-info", ticker],
    queryFn: () => api.get(`/api/coins/info/${ticker}`).then((r) => r.data),
    enabled: !!ticker,
    staleTime: 5 * 60_000,
  });
}

export function useSearchCoins(query: string) {
  return useQuery<CoinSearchResult[]>({
    queryKey: ["coin-search", query],
    queryFn: () => api.get("/api/coins/search", { params: { q: query } }).then((r) => r.data),
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

export function useAddCoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CoinSearchResult) => api.post("/api/coins", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coins"] }),
  });
}

export function useDeleteCoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => api.delete(`/api/coins/${ticker}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coins"] }),
  });
}

export function useCoinChart(ticker: string, interval = "day") {
  return useQuery<CoinPriceSnapshot[]>({
    queryKey: ["coin-chart", ticker, interval],
    queryFn: () =>
      api.get(`/api/coin-prices/${ticker}/chart`, { params: { interval } }).then((r) => r.data),
    enabled: !!ticker,
    refetchInterval: 60 * 60 * 1000,
  });
}

export function useCoinAlerts(page = 1) {
  return useQuery<CoinAlertsResponse>({
    queryKey: ["coin-alerts", page],
    queryFn: () => api.get("/api/coin-alerts", { params: { page } }).then((r) => r.data),
  });
}

export function useCoinUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["coin-unread-count"],
    queryFn: () => api.get("/api/coin-alerts/unread-count").then((r) => r.data),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useMarkCoinRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids?: number[]; all?: boolean }) =>
      api.post("/api/coin-alerts/mark-read", undefined, { params: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coin-unread-count"] });
      qc.invalidateQueries({ queryKey: ["coin-alerts"] });
    },
  });
}

export function useCoinAlertSettings(ticker: string) {
  return useQuery<CoinAlertSetting>({
    queryKey: ["coin-alert-settings", ticker],
    queryFn: () => api.get(`/api/coin-alerts/settings/${ticker}`).then((r) => r.data),
    enabled: !!ticker,
  });
}

export function useUpdateCoinAlertSettings(ticker: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CoinAlertSetting>) =>
      api.put(`/api/coin-alerts/settings/${ticker}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coin-alert-settings", ticker] });
    },
  });
}

export function useManualCoinScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/coin-alerts/scan").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coin-alerts"] });
    },
  });
}

export function useGlobalCoinAlertSettings() {
  return useQuery<GlobalCoinAlertSetting>({
    queryKey: ["global-coin-alert-settings"],
    queryFn: () => api.get("/api/coin-alerts/global-settings").then((r) => r.data),
  });
}

export function useUpdateGlobalCoinAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<GlobalCoinAlertSetting>) =>
      api.put("/api/coin-alerts/global-settings", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-coin-alert-settings"] }),
  });
}
