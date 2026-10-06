import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Asset Studio",
  description: "App Store와 Google Ads 광고 소재를 브라우저에서 바로 뽑는다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
