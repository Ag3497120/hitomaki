import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ひと巻き — これからの時間を考える',
  icons: { icon: '/favicon.svg' },
  description:
    'トイレットペーパーを交換するたび、過ぎた時間を振り返り、次のひと巻きの小さな目標を決める。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
