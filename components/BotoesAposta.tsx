'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

type Casa = {
  nome: string;
  url: string;
  cor: string; // classes Tailwind do botão
};

// EDITE AQUI: lista das suas casas de aposta favoritas.
// O placeholder {jogo} (se a casa suportar busca por URL) será substituído.
const CASAS: Casa[] = [
  {
    nome: 'Bet365',
    url: 'https://www.bet365.com/',
    cor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    nome: 'Betfair',
    url: 'https://www.betfair.com/exchange/plus/football',
    cor: 'bg-yellow-500 hover:bg-yellow-600 text-black',
  },
  {
    nome: 'Bolsa de Aposta',
    url: 'https://bolsadeaposta.bet.br/b/exchange',
    cor: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
];

export default function BotoesAposta({ jogo }: { jogo: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiarECTabir(casa: Casa) {
    try {
      // Copia o nome do jogo pro clipboard
      await navigator.clipboard.writeText(jogo);
      setCopiado(casa.nome);
      setTimeout(() => setCopiado(null), 2000);
    } catch (err) {
      // Clipboard pode falhar em alguns navegadores — segue mesmo assim
      console.warn('Falha ao copiar:', err);
    }
    // Substitui placeholder {jogo} se houver
    const url = casa.url.includes('{jogo}')
      ? casa.url.replace('{jogo}', encodeURIComponent(jogo))
      : casa.url;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function soCopiar() {
    try {
      await navigator.clipboard.writeText(jogo);
      setCopiado('clipboard');
      setTimeout(() => setCopiado(null), 2000);
    } catch (err) {
      console.warn('Falha ao copiar:', err);
    }
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
        Apostar em
      </div>
      <div className="flex flex-wrap gap-2">
        {CASAS.map((casa) => (
          <button
            key={casa.nome}
            type="button"
            onClick={() => copiarECTabir(casa)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${casa.cor}`}
            title={`Abrir ${casa.nome} e copiar nome do jogo`}
          >
            {casa.nome}
            {copiado === casa.nome ? (
              <Check size={14} />
            ) : (
              <ExternalLink size={14} />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={soCopiar}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 transition"
          title="Copiar nome do jogo para colar em qualquer app"
        >
          {copiado === 'clipboard' ? (
            <>
              <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
              Copiado!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copiar nome
            </>
          )}
        </button>
      </div>
      <p className="text-[11px] text-ink-500 mt-2">
        Ao clicar numa casa, o nome do jogo é copiado. Cole (Ctrl+V) no buscador da casa.
      </p>
    </div>
  );
}
