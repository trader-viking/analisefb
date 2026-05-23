'use client';

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { toPng } from 'html-to-image';

type Props = {
  // Função que retorna o elemento a ser capturado
  alvoRef: React.RefObject<HTMLElement>;
  // Nome do arquivo (sem extensão)
  nomeArquivo: string;
  // Variante visual
  variante?: 'icone' | 'botao';
  className?: string;
};

export default function BotaoBaixarImagem({ alvoRef, nomeArquivo, variante = 'icone', className = '' }: Props) {
  const [estado, setEstado] = useState<'idle' | 'gerando' | 'ok'>('idle');

  async function baixar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = alvoRef.current;
    if (!el) return;

    setEstado('gerando');
    try {
      // Detecta o fundo conforme o tema atual (claro/escuro)
      const isDark = document.documentElement.classList.contains('dark');
      const bg = isDark ? '#0f172a' : '#ffffff';

      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        pixelRatio: 2, // resolução 2x = nítido
        // Esconde elementos marcados com data-no-export (botões)
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset.noExport === 'true') return false;
          return true;
        },
      });

      const link = document.createElement('a');
      const slug = nomeArquivo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      link.download = `${slug || 'card'}.png`;
      link.href = dataUrl;
      link.click();

      setEstado('ok');
      setTimeout(() => setEstado('idle'), 1500);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      setEstado('idle');
    }
  }

  if (variante === 'botao') {
    return (
      <button
        type="button"
        onClick={baixar}
        data-no-export="true"
        className={`btn btn-secondary justify-center w-full ${className}`}
      >
        {estado === 'ok' ? <Check size={14} /> : <Download size={14} />}
        {estado === 'gerando' ? 'Gerando...' : estado === 'ok' ? 'Baixado!' : 'Baixar imagem'}
      </button>
    );
  }

  // Variante ícone (discreto, canto do card)
  return (
    <button
      type="button"
      onClick={baixar}
      data-no-export="true"
      title="Baixar imagem do card"
      className={`p-1.5 rounded-md text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition ${className}`}
    >
      {estado === 'ok' ? <Check size={15} /> : <Download size={15} />}
    </button>
  );
}
