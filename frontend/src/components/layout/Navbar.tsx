import Link from "next/link";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold text-white">RichBot</Link>
        <Link href="/watchlist"    className="text-gray-300 hover:text-white text-sm">관심종목</Link>
        <Link href="/all-stocks"   className="text-gray-300 hover:text-white text-sm">주식</Link>
        <Link href="/coins"        className="text-gray-300 hover:text-white text-sm">코인</Link>
        <Link href="/coin-alerts"  className="text-gray-300 hover:text-white text-sm">코인알림</Link>
        <Link href="/alerts"       className="text-gray-300 hover:text-white text-sm">주식알림</Link>
        <Link href="/disclosures"  className="text-gray-300 hover:text-white text-sm">공시</Link>
      </div>
      <NotificationBell />
    </nav>
  );
}
