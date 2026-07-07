'use client';

/**
 * Melhoria #7 — Notificação push no navegador.
 * Além do Telegram: avisa quando um jogo do relatório de hoje está pra
 * começar (15min antes) e quando um resultado foi auditado (green/red).
 *
 * COMO USAR (app/layout.tsx, dentro do <body>):
 *   import NotificacoesPush from '@/components/NotificacoesPush';
 *   ...
 *   <NotificacoesPush />
 *
 * Como funciona:
 * 1. Registra /sw.js (Service Worker em public/sw.js)
 * 2. Mostra um botão discreto "🔔 Ativar avisos" até o usuário permitir
 * 3. Com permissão: a cada 60s confere
 *    a) horários das entradas de hoje (relatorio_HOJE.json) → notifica
 *       15min antes de cada jogo (uma vez só, controlado por localStorage)
 *    b) placares auditados (_veredito nos relatórios) → notifica green/red
 * As notificações são exibidas pelo SW (showNotification), então aparecem
 * mesmo com a aba em segundo plano. Observação honesta: com o navegador
 * TOTALMENTE fechado só chega notificação com Web Push + servidor (VAPID);
 * o handler 'push' já está pronto no sw.js se quiser evoluir pra isso.
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

type EntradaMin = {
  jogo: string;
  horario?: string;
  _veredito?: string;
  _placar?: string;
};

const LS_KEY = 'analisefb:notificados'; // tags já disparadas (evita repetir)

function jaNotificado(tag: string): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(s) && s.includes(tag);
  } catch { return false; }
}

function marcarNotificado(tag: string) {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const novo = Array.isArray(s) ? s : [];
    novo.push(tag);
    localStorage.setItem(LS_KEY, JSON.stringify(novo.slice(-200)));
  } catch {}
}

async function notificarViaSW(titulo: string, corpo: string, tag: string, url: string) {
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ tipo: 'notificar', titulo, corpo, tag, url });
}

export default function NotificacoesPush() {
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>('default');

  // 1. Registra o Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      setPermissao('indisponivel');
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => setPermissao('indisponivel'));
    setPermissao(Notification.permission);
  }, []);

  // 2. Loop de checagem (só com permissão concedida)
  useEffect(() => {
    if (permissao !== 'granted') return;

    const hoje = new Date().toISOString().slice(0, 10);

    async function checar() {
      // Carrega o relatório de hoje direto do site (arquivo estático já
      // publicado pelo pipeline — sem custo de API)
      let entradas: EntradaMin[] = [];
      try {
        const r = await fetch(`/relatorios/relatorio_${hoje}.json`, { cache: 'no-store' });
        if (r.ok) {
          const rel = await r.json();
          if (Array.isArray(rel?.entradas)) entradas = rel.entradas;
        }
      } catch { return; }

      const agora = Date.now();
      for (const e of entradas) {
        // a) Jogo começando em ≤15min
        const m = (e.horario || '').match(/(\d{1,2}):(\d{2})/);
        if (m) {
          const alvo = new Date(`${hoje}T${m[1].padStart(2, '0')}:${m[2]}:00`).getTime();
          const faltamMin = (alvo - agora) / 60000;
          const tag = `inicio:${hoje}:${e.jogo}`;
          if (faltamMin > 0 && faltamMin <= 15 && !jaNotificado(tag)) {
            marcarNotificado(tag);
            await notificarViaSW(
              '⏰ Jogo começando',
              `${e.jogo} começa em ${Math.ceil(faltamMin)}min (${e.horario})`,
              tag,
              `/relatorio/${hoje}/`
            );
          }
        }
        // b) Resultado auditado (green/red gravado pelo worker)
        if (e._veredito === 'green' || e._veredito === 'red') {
          const tag = `veredito:${hoje}:${e.jogo}:${e._veredito}`;
          if (!jaNotificado(tag)) {
            marcarNotificado(tag);
            const emoji = e._veredito === 'green' ? '✅ GREEN' : '❌ RED';
            await notificarViaSW(
              emoji,
              `${e.jogo}${e._placar ? ` · ${e._placar}` : ''}`,
              tag,
              `/relatorio/${hoje}/`
            );
          }
        }
      }
    }

    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [permissao]);

  if (permissao === 'indisponivel' || permissao === 'granted') return null;

  async function pedir() {
    try {
      const p = await Notification.requestPermission();
      setPermissao(p);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={pedir}
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-xs font-medium bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-700 text-ink-700 dark:text-ink-200 hover:ring-emerald-400 transition"
      title="Receber aviso 15min antes dos jogos e quando sair green/red"
    >
      {permissao === 'denied' ? <BellOff size={14} /> : <Bell size={14} />}
      {permissao === 'denied' ? 'Avisos bloqueados no navegador' : 'Ativar avisos'}
    </button>
  );
}
