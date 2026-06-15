import CoinAlertList from "@/components/coins/CoinAlertList";
import GlobalCoinAlertSettings from "@/components/coins/GlobalCoinAlertSettings";
export default function CoinAlertsPage() {
  return (
    <div className="space-y-4">
      <GlobalCoinAlertSettings />
      <CoinAlertList />
    </div>
  );
}
