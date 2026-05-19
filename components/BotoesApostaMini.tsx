'use client';

import { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';

// Mesmas casas do componente principal — mantém sincronizado
const CASAS = [
  { nome: 'Bet365', url: 'https://www.bet365.com/', cor: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { nome: 'Betfair', url: 'https://www.betfair.com/exchange/plus/football', cor: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
  { nome: 'Bolsa de Aposta', url: 'https://bolsadeaposta.bet.br/b/exchange', cor: 'bg-blue-600 hover:bg-blue-700 text-white' },
];

export default function BotoesApostaMini({ jogo }: { jogo: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function abrir(casa: typeof CASAS[number], e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(jogo);
      setCopiado(casa.nome);
      setTimeout(() => setCopiado(null), 1500);
    } catch {}
    window.open(casa.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {CASAS.map((casa) => (
        <button
          key={casa.nome}
          type="button"
          onClick={(e) => abrir(casa, e)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${casa.cor}`}
          title={`Abrir ${casa.nome} e copiar "${jogo}"`}
        >
          {casa.nome}
          {copiado === casa.nome ? <Check size={10} /> : <ExternalLink size={10} />}
        </button>
      ))}
    </div>
  );
}
