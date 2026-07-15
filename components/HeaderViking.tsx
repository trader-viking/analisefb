'use client';

/**
 * HEADER da marca Análises Trader Viking — viking premium (ouro/escuro).
 * Auto-suficiente: estilos inline + classes tv- (de marca-viking.css).
 * Substitui o cabeçalho atual. Uso em app/layout.tsx:
 *   import HeaderViking from '@/components/HeaderViking';
 *   <HeaderViking />
 *
 * Assinatura da marca: o fio dourado sob o header (tv-regua) e o
 * monograma-machado. O ouro aparece SÓ na marca e no fio — o resto
 * fica escuro e quieto, pra o dourado ter valor (restrição = premium).
 */
import Link from 'next/link';

export default function HeaderViking() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{ background: 'rgba(18,16,11,0.85)' }}
    >
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Marca: logo + nome */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Logo inline (não depende de arquivo externo) */}
          <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden="true"
               className="transition-transform group-hover:scale-105">
            <defs>
              <linearGradient id="hv-ouro" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#F4D588"/>
                <stop offset="0.5" stopColor="#C9962E"/>
                <stop offset="1" stopColor="#8A6516"/>
              </linearGradient>
              <linearGradient id="hv-brilho" x1="14" y1="10" x2="30" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FBE7B8"/>
                <stop offset="1" stopColor="#D3A63C"/>
              </linearGradient>
            </defs>
            <path d="M24 2 L42 9 V25 C42 36 34 43 24 46 C14 43 6 36 6 25 V9 Z"
                  fill="#12100B" stroke="url(#hv-ouro)" strokeWidth="1.5"/>
            <path d="M17 13 L24 30 L31 13" stroke="url(#hv-brilho)" strokeWidth="3.2"
                  strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M31 13 C35 14 37.5 17 37 21 C34.5 20 32 19 30 19.5 Z" fill="url(#hv-ouro)"/>
            <path d="M17 13 C13 14 10.5 17 11 21 C13.5 20 16 19 18 19.5 Z" fill="url(#hv-ouro)"/>
            <path d="M24 34 L20 40 H28 Z" fill="url(#hv-brilho)"/>
          </svg>
          {/* Nome: "TRADER VIKING" em display, "Análises" como eyebrow */}
          <span className="leading-none">
            <span className="block text-[9px] uppercase tracking-[0.25em] text-[#9B9384]">
              Análises
            </span>
            <span
              className="block text-lg font-bold uppercase tracking-tight"
              style={{
                fontFamily: '"Oswald","Archivo Narrow",system-ui,sans-serif',
                background: 'linear-gradient(135deg,#F4D588 0%,#C9962E 55%,#8A6516 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent', color: 'transparent',
              }}
            >
              Trader Viking
            </span>
          </span>
        </Link>

        {/* Ações à direita */}
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/desempenho"
            className="text-[#EDE7D8] hover:text-[#F4D588] transition-colors font-medium"
          >
            Auditoria
          </Link>
          <ThemeToggleSlot />
        </nav>
      </div>
      {/* Fio dourado — a assinatura estrutural da marca */}
      <div
        style={{
          height: 1,
          background:
            'linear-gradient(90deg,transparent,#C9962E 20%,#C9962E 80%,transparent)',
          opacity: 0.5,
        }}
      />
    </header>
  );
}

/* Se você já tem um botão de tema (sol/lua), coloque-o aqui no lugar
   deste placeholder — mantém a posição sem quebrar o layout. */
function ThemeToggleSlot() {
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-[#C9962E]"
      style={{ border: '1px solid #2A2620' }}
      aria-hidden="true"
      title="Tema"
    >
      ☾
    </span>
  );
}
