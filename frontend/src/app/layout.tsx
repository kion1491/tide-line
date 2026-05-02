import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tide Line | 하락 추세 정밀 진단",
  description: "종목의 하락 추세 전환 여부와 페이크 가능성을 7개 지표로 정밀 진단하는 보조 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
