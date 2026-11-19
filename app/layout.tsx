import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

// 한글 글꼴 (design/wireframe.md 0절: Pretendard 또는 IBM Plex Sans KR)
const plexKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "저수지 치수안정성 평가",
  description: "전국 농업용 저수지 치수안정성 평가 (reservoir-flood-check)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${plexKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
