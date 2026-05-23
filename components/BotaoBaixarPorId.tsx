'use client';

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { toPng } from 'html-to-image';

type Props = {
  // ID do elemento a capturar
  alvoId: string;
  nomeArquivo: string;
  className?: string;
};

export default function BotaoBaixarPorId({ alvoId, nomeArquivo, className = '' }: Props) {
  const [estado, setEstado] = useState<'idle' | 'gerando' | 'ok'>('idle');

  async function baixar() {
    const el = document.getElementById(alvoId);
    if (!el) return;

    setEstado('gerando');
    try {
      const isDark = document.documentElement.classList.contains('dark');
      const bg = isDark ? '#0f172a' : '#ffffff';

      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        pixelRatio: 2,
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
      link.download = `${slug || 'analise'}.png`;
      link.href = dataUrl;
      link.click();

      setEstado('ok');
      setTimeout(() => setEstado('idle'), 1500);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      setEstado('idle');
    }
  }

  return (
    <button
      type="button"
      onClick={baixar}
      data-no-export="true"
      className={`btn btn-secondary justify-center ${className}`}
    >
      {estado === 'ok' ? <Check size={14} /> : <Download size={14} />}
      {estado === 'gerando' ? 'Gerando...' : estado === 'ok' ? 'Baixado!' : 'Baixar imagem'}
    </button>
  );
}
