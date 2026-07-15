'use client';

/**
 * BotaoInstalar — oferece instalar o site como app (PWA).
 * Comportamento por plataforma:
 *  - Android/Chrome/Edge: captura o evento nativo e mostra botão
 *    "Instalar app" → toque abre o diálogo de instalação do sistema.
 *  - iOS/Safari: iOS não dispara o evento; mostramos uma dica curta
 *    (Compartilhar → Adicionar à Tela de Início), que é o caminho real.
 *  - Já instalado (rodando em standalone): não mostra nada.
 *
 * Uso em app/layout.tsx (dentro do <body>):
 *   import BotaoInstalar from '@/components/BotaoInstalar';
 *   <BotaoInstalar />
 */
import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function BotaoInstalar() {
  const [prompt, setPrompt] = useState<any>(null);
  const [mostrar, setMostrar] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);
  const [dicaIOS, setDicaIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Já instalado? (rodando como app) → não oferece
    const jaInstalado =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (jaInstalado) return;

    // iOS não suporta o prompt nativo — detecta pra mostrar a dica manual
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    if (isIOS) {
      setEhIOS(true);
      setMostrar(true);
      return;
    }

    // Android/desktop: captura o evento de instalação
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setMostrar(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setMostrar(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!mostrar) return null;

  async function instalar() {
    if (ehIOS) { setDicaIOS(true); return; }
    if (!prompt) return;
    prompt.prompt();
    const escolha = await prompt.userChoice;
    if (escolha?.outcome === 'accepted') setMostrar(false);
    setPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={instalar}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-xs font-semibold transition"
        style={{
          background: 'linear-gradient(135deg,#F4D588,#C9962E 60%,#8A6516)',
          color: '#12100B',
        }}
        title="Instalar o app na tela inicial"
      >
        <Download size={14} />
        Instalar app
      </button>

      {/* Dica iOS (Safari não tem instalação em 1 toque) */}
      {dicaIOS && (
        <div
          className="fixed bottom-16 left-4 right-4 z-50 max-w-xs rounded-lg p-3 shadow-xl text-[13px]"
          style={{ background: '#1A1712', border: '1px solid #C9962E', color: '#EDE7D8' }}
        >
          <button
            onClick={() => setDicaIOS(false)}
            className="absolute top-2 right-2 text-[#9B9384]"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
          <div className="font-semibold mb-1" style={{ color: '#F4D588' }}>
            Instalar no iPhone
          </div>
          Toque em <Share size={13} className="inline mx-0.5" /> (Compartilhar) na
          barra do Safari e depois em <b>Adicionar à Tela de Início</b>.
        </div>
      )}
    </>
  );
}
