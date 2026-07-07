'use client';

/**
 * Melhoria #9 — Botão "Copiar entrada pro Telegram".
 * Copia texto formatado pro clipboard:
 *   "⚽ Novorizontino x Vila Nova | Lay 1×0 | Odd 10.50 | Stake 2%"
 * Simples: navigator.clipboard.writeText + feedback visual de 1.5s.
 */
import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { METODOS_INFO, planoDoMetodo } from '@/components/BadgeMetodo';
import type { Entrada } from '@/lib/relatorios';

export default function BotaoCopiarTelegram({
  entrada,
  metodoPrincipal,
}: {
  entrada: Entrada;
  metodoPrincipal: string | null;
}) {
  const [copiado, setCopiado] = useState(false);

  function montarTexto(): string {
    const partes: string[] = [`⚽ ${entrada.jogo}`];
    if (metodoPrincipal) {
      const label = METODOS_INFO[metodoPrincipal]?.label || metodoPrincipal;
      partes.push(label);
      const { odd, stake, saida } = planoDoMetodo(entrada, metodoPrincipal);
      if (odd) partes.push(`Odd ${odd}`);
      if (stake) partes.push(`Stake ${stake}`);
      if (saida) partes.push(`Saída: ${saida}`);
    } else if (entrada.mercado_principal) {
      partes.push(entrada.mercado_principal);
    }
    if (entrada.horario) partes.push(`🕐 ${entrada.horario}`);
    return partes.join(' | ');
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(montarTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Fallback pra contextos sem clipboard API (http, iframes antigos)
      try {
        const ta = document.createElement('textarea');
        ta.value = montarTexto();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      } catch {}
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Copiar entrada formatada (pra colar no Telegram)"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition ${
        copiado
          ? 'bg-emerald-600 text-white'
          : 'ring-1 ring-sky-200 dark:ring-sky-900 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30'
      }`}
    >
      {copiado ? <Check size={12} /> : <Send size={12} />}
      {copiado ? 'Copiado!' : 'Telegram'}
    </button>
  );
}
