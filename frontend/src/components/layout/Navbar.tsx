"use client";
import { useState } from "react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";

const NAV_LINKS = [
  { href: "/watchlist", label: "관심종목" },
  { href: "/all-stocks", label: "주식" },
  { href: "/coins", label: "코인" },
  { href: "/coin-alerts", label: "코인알림" },
  { href: "/alerts", label: "주식알림" },
  { href: "/disclosures", label: "공시" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 햄버거 버튼 (모바일 전용) */}
          <button
            className="md:hidden text-gray-300 hover:text-white"
            onClick={() => setOpen((o) => !o)}
            aria-label="메뉴 열기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
          <Link href="/" className="text-xl font-bold text-white">RichBot</Link>
          {/* 데스크탑 링크 */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="text-gray-300 hover:text-white text-sm">{label}</Link>
            ))}
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* 모바일 드롭다운 */}
      {open && (
        <>
          <div className="fixed inset-0 z-10 md:hidden" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 bg-gray-900 border-b border-gray-700 shadow-lg md:hidden">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-6 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white border-b border-gray-800 last:border-0"
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
