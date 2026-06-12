import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Providers from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RichBot - 주식 모니터링",
  description: "한국 주식 관심종목 모니터링 및 AI 해설 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`}>
      <body className="bg-gray-950 text-white min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
            {children}
          </main>
          <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
            본 서비스가 제공하는 정보는 투자 참고 자료이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
