"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AlertsResponse, Notification, AlertSetting } from "@/types";

export function useAlerts(page = 1) {
  return useQuery<AlertsResponse>({
    queryKey: ["alerts", page],
    queryFn: () => api.get("/api/alerts", { params: { page } }).then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["unread-count"],
    queryFn: () => api.get("/api/alerts/unread-count").then((r) => r.data),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useNotifications(page = 1) {
  return useQuery<Notification[]>({
    queryKey: ["notifications", page],
    queryFn: () => api.get("/api/notifications", { params: { page } }).then((r) => r.data),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids?: number[]; all?: boolean }) =>
      api.post("/api/alerts/mark-read", undefined, { params: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unread-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useAlertSettings(ticker: string) {
  return useQuery<AlertSetting>({
    queryKey: ["alert-settings", ticker],
    queryFn: () => api.get(`/api/alerts/settings/${ticker}`).then((r) => r.data),
    enabled: !!ticker,
  });
}

export function useUpdateAlertSettings(ticker: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AlertSetting>) =>
      api.put(`/api/alerts/settings/${ticker}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-settings", ticker] });
    },
  });
}
