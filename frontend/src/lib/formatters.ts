export function formatKRW(value: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "decimal" }).format(Math.round(value)) + "원";
}

export function formatPct(value: number): string {
  return (value >= 0 ? "+" : "") + (value * 100).toFixed(1) + "%";
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + "M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + "K";
  return vol.toString();
}

export function crossLabel(eventType: string): string {
  if (eventType.startsWith("GOLDEN")) return "골든크로스";
  if (eventType.startsWith("DEAD")) return "데드크로스";
  return eventType;
}
