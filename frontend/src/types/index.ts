export interface Stock {
  id: number;
  ticker: string;
  name: string;
  market: string;
  added_at: string;
  is_active: boolean;
  latest_price?: PriceSnapshot | null;
}

export interface PriceSnapshot {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number;
  volume: number;
  ma20?: number | null;
  ma50?: number | null;
  ma60?: number | null;
  ma120?: number | null;
  ma200?: number | null;
  ma240?: number | null;
  volume_ratio?: number | null;
}

export interface CrossEvent {
  id: number;
  stock_id: number;
  stock_name?: string | null;
  ticker?: string | null;
  market?: string | null;
  event_type: string;
  short_ma: string;
  long_ma: string;
  short_val: number;
  long_val: number;
  occurred_at: string;
  notified: boolean;
}

export interface VolumeSpikeEvent {
  id: number;
  stock_id: number;
  stock_name?: string | null;
  ticker?: string | null;
  market?: string | null;
  date: string;
  current_volume?: number | null;
  avg_volume_20?: number | null;
  ratio: number;
  threshold: number;
  notified: boolean;
  occurred_at: string;
}

export interface AlertSetting {
  stock_id: number;
  enabled_pairs: string[];
  volume_spike: boolean;
  volume_threshold: number;
  push_notify: boolean;
}

export interface Notification {
  id: number;
  stock_id?: number | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Disclosure {
  id: number;
  stock_id?: number | null;
  dart_rcept_no: string;
  corp_name: string;
  report_nm: string;
  rcept_dt: string;
  raw_url?: string | null;
  summary?: string | null;
  summary_at?: string | null;
}

export interface GlobalAlertSetting {
  scan_all_stocks: boolean;
  enabled_pairs: string[];
  volume_spike: boolean;
  volume_threshold: number;
}

export interface AiCommentary {
  id: number;
  stock_id: number;
  date: string;
  commentary: string;
  model_used?: string | null;
  generated_at: string;
}

export interface StockSearchResult {
  ticker: string;
  name: string;
  market: string;
}

export interface AlertsResponse {
  cross_events: CrossEvent[];
  volume_spikes: VolumeSpikeEvent[];
}

// ── 코인 타입 ──────────────────────────────────────────────────────────────

export interface CoinPriceSnapshot {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number;
  volume: number;
  ma7?: number | null;
  ma20?: number | null;
  ma25?: number | null;
  ma50?: number | null;
  ma99?: number | null;
  ma200?: number | null;
  volume_ratio?: number | null;
}

export interface Coin {
  id: number;
  ticker: string;
  name: string;
  is_active: boolean;
  added_at: string;
  latest_price?: CoinPriceSnapshot | null;
}

export interface CoinSearchResult {
  ticker: string;
  name: string;
}

export interface CoinCrossEvent {
  id: number;
  coin_id: number;
  coin_name?: string | null;
  ticker?: string | null;
  event_type: string;
  short_ma: string;
  long_ma: string;
  short_val: number;
  long_val: number;
  occurred_at: string;
  notified: boolean;
}

export interface CoinVolumeSpikeEvent {
  id: number;
  coin_id: number;
  coin_name?: string | null;
  ticker?: string | null;
  date: string;
  current_volume?: number | null;
  avg_volume_20?: number | null;
  ratio: number;
  threshold: number;
  notified: boolean;
  occurred_at: string;
}

export interface CoinAlertSetting {
  coin_id: number;
  enabled_pairs: string[];
  volume_spike: boolean;
  volume_threshold: number;
  push_notify: boolean;
}

export interface CoinAlertsResponse {
  cross_events: CoinCrossEvent[];
  volume_spikes: CoinVolumeSpikeEvent[];
}


export interface CoinAiCommentary {
  id: number;
  coin_id: number;
  date: string;
  commentary: string;
  model_used?: string | null;
  generated_at: string;
}

export interface GlobalCoinAlertSetting {
  id: number;
  enabled_pairs: string[];
  volume_spike: boolean;
  volume_threshold: number;
}
