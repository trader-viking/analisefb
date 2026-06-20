'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users } from 'lucide-react';

export default function NavegacaoPrincipal() {
  const pathname = usePathname() || '/';

  const ehJogadores = pathname.startsWith('/jogadores');
  const ehDesempenho = pathname === '/desempenho';
  const ehPartidas = !ehJogadores && !ehDesempenho;

  return (
    <nav className="flex items-center gap-1 mb-6 -mx-1">
      <Link
        href="/"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
          ehPartidas
            ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
            : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-900'
        }`}
      >
        <BarChart3 size={15} />
        Partidas
      </Link>

      <Link
        href="/jogadores"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
          ehJogadores
            ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
            : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-900'
        }`}
      >
        <Users size={15} />
        Jogadores
      </Link>
    </nav>
  );
}
