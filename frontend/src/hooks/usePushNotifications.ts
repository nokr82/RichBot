"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
  }, []);

  async function subscribe() {
    if (!supported) return;
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const json = sub.toJSON();
      await api.post("/api/notifications/subscribe", {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 구독에 실패했습니다.");
    }
  }

  return { supported, subscribed, subscribe, error };
}
