import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gêmeo Digital MR: Campus Facens & Splice Smart Solutions',
  description:
    'Protótipo Interativo em Realidade Mista (Browser) do Sistema Viário e Câmeras Inteligentes Splice no Campus UniFacens.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
