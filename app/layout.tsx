import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    template: "%s | 과몰입구역",
    default: "과몰입구역 — 심리테스트·미니게임·퀴즈",
  },
  description: "1분이면 끝나는 심리테스트, 미니게임, 퀴즈. 오늘은 뭐에 과몰입해볼까?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fastly.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://fastly.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-(--color-bg-canvas)">{children}</body>
    </html>
  );
}
