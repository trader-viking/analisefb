import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import BotaoInstalar from '@/components/BotaoInstalar';
import NotificacoesPush from '@/components/NotificacoesPush';

export const metadata: Metadata = {
  title: 'Análises Trader Viking',
  description: 'Quadros operacionais diários · entradas e análises de trading esportivo',
  manifest: '/manifest.json',
  themeColor: '#12100B',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Fonte display da marca (viking, condensada) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>
        {/* ===== HEADER VIKING PREMIUM ===== */}
        <header
          className="sticky top-0 z-30 backdrop-blur-md"
          style={{ background: 'rgba(18,16,11,0.85)' }}
        >
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Marca: logo machado + nome */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <svg
                width="34"
                height="34"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
                className="transition-transform group-hover:scale-105"
              >
                <defs>
                  <linearGradient id="hv-ouro" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#F4D588" />
                    <stop offset="0.5" stopColor="#C9962E" />
                    <stop offset="1" stopColor="#8A6516" />
                  </linearGradient>
                  <linearGradient id="hv-brilho" x1="14" y1="10" x2="30" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FBE7B8" />
                    <stop offset="1" stopColor="#D3A63C" />
                  </linearGradient>
                </defs>
                <path
                  d="M24 2 L42 9 V25 C42 36 34 43 24 46 C14 43 6 36 6 25 V9 Z"
                  fill="#12100B"
                  stroke="url(#hv-ouro)"
                  strokeWidth="1.5"
                />
                <path
                  d="M17 13 L24 30 L31 13"
                  stroke="url(#hv-brilho)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path d="M31 13 C35 14 37.5 17 37 21 C34.5 20 32 19 30 19.5 Z" fill="url(#hv-ouro)" />
                <path d="M17 13 C13 14 10.5 17 11 21 C13.5 20 16 19 18 19.5 Z" fill="url(#hv-ouro)" />
                <path d="M24 34 L20 40 H28 Z" fill="url(#hv-brilho)" />
              </svg>
              <span className="leading-none">
                <span className="block text-[9px] uppercase tracking-[0.25em] text-[#9B9384]">
                  Análises
                </span>
                <span
                  className="block text-lg font-bold uppercase tracking-tight"
                  style={{
                    fontFamily: '"Oswald","Archivo Narrow",system-ui,sans-serif',
                    background: 'linear-gradient(135deg,#F4D588 0%,#C9962E 55%,#8A6516 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}
                >
                  Trader Viking
                </span>
              </span>
            </Link>

            {/* Ações à direita */}
            <div className="flex items-center gap-1 sm:gap-3">
              <Link
                href="/auditoria/"
                className="text-sm font-medium px-3 py-1.5 rounded-md text-[#EDE7D8] hover:text-[#F4D588] transition-colors"
              >
                Auditoria
              </Link>
              <ThemeToggle />
            </div>
          </div>
          {/* Fio dourado — assinatura estrutural da marca */}
          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg,transparent,#C9962E 20%,#C9962E 80%,transparent)',
              opacity: 0.5,
            }}
          />
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

        <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-ink-500 text-center">
          Análises geradas automaticamente · Não constitui recomendação de aposta
        </footer>

        {/* Botão de instalar como app (PWA) */}
        <BotaoInstalar />
        {/* Notificações push: sino "Ativar avisos" + checagem de jogos/vereditos */}
        <NotificacoesPush />
      </body>
    </html>
  );
}
