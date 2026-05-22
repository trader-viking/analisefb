import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Análises Trader',
  description: 'Quadros operacionais diários',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
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
        <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-ink-950/80 border-b border-ink-200 dark:border-ink-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-bold tracking-tight text-lg hover:opacity-70 transition">
              📊 Análises Trader
            </Link>
            <div className="flex items-center gap-1 sm:gap-3">
              <Link
                href="/auditoria/"
                className="text-sm font-medium px-3 py-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800 transition"
              >
                Auditoria
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-ink-500 text-center">
          Análises geradas automaticamente · Não constitui recomendação de aposta
        </footer>
      </body>
    </html>
  );
}
