'use client';

/**
 * Melhoria #6 — Contador regressivo até o horário da partida.
 * Em vez de só "20:00", mostra "em 1h23min". 100% client-side
 * (useEffect + setInterval), sem API nova.
 *
 * Props:
 *   data    — "2026-07-04" (data do relatório, vem do slug)
 *   horario — "20:00" (campo horario da entrada)
 *
 * Comportamento:
 *   - > 24h de distância → não mostra nada (o horário já basta)
 *   - futuro             → "em 1h23min" (verde quando < 30min)
 *   - passou < 2h30      → "começou há 12min" (o jogo deve estar rolando;
 *                           some quando o placar ao vivo assume)
 *   - passou > 2h30      → não mostra nada
 */
import { useEffect, useState } from 'react';

function calcular(data: string, horario: string): string | null {
  const m = (horario || '').match(/(\d{1,2}):(\d{2})/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const alvo = new Date(`${data}T${m[1].padStart(2, '0')}:${m[2]}:00`);
  if (isNaN(alvo.getTime())) return null;

  const diffMs = alvo.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin > 24 * 60) return null;
  if (diffMin >= 0) {
    const h = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    if (h > 0) return `em ${h}h${String(min).padStart(2, '0')}min`;
    if (min === 0) return 'começando agora';
    return `em ${min}min`;
  }
  const atras = -diffMin;
  if (atras <= 150) {
    if (atras < 60) return `começou há ${atras}min`;
    return `começou há ${Math.floor(atras / 60)}h${String(atras % 60).padStart(2, '0')}min`;
  }
  return null;
}

export default function CountdownPartida({ data, horario }: { data: string; horario?: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [urgente, setUrgente] = useState(false);

  useEffect(() => {
    if (!horario) return;
    const atualizar = () => {
      const t = calcular(data, horario);
      setTexto(t);
      // urgente = falta menos de 30min pra começar
      const m = (horario || '').match(/(\d{1,2}):(\d{2})/);
      if (m) {
        const alvo = new Date(`${data}T${m[1].padStart(2, '0')}:${m[2]}:00`).getTime();
        const diffMin = (alvo - Date.now()) / 60000;
        setUrgente(diffMin >= 0 && diffMin <= 30);
      }
    };
    atualizar();
    const id = setInterval(atualizar, 30_000);
    return () => clearInterval(id);
  }, [data, horario]);

  if (!texto) return null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
        urgente
          ? 'bg-emerald-600 text-white'
          : texto.startsWith('começou')
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
            : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
      }`}
      suppressHydrationWarning
    >
      {texto}
    </span>
  );
}
