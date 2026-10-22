import type { Metadata } from 'next';
import { Barlow_Condensed, Noto_Sans_TC } from 'next/font/google';
import './globals.css';

const sans = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CryptoTracker 競賽排行榜',
  description: '加密貨幣交易機器人競賽的唯讀排行榜',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
