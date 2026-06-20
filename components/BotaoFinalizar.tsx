'use client';

import { useState } from 'react';
import { CheckCircle2, X, Loader2 } from 'lucide-react';

interface BotaoFinalizarProps {
  jogo: string;
  data: string;
  jaFinalizado?: boolean;
  placarAtual?: string;
  variante?: 'icone' | 'completo';
  temOverLimite?: boolean;
  onFinalizado?: () => void;
}

export default function BotaoFinalizar({
  jogo,
  data,
  jaFinalizado = false,
  placarAtual = '',
  variante = 'completo',
  temOverLimite = false,
  onFinalizado,
}: BotaoFinalizarProps) {
  const [aberto, setAberto] = useState(false);
  const [placarCasa, setPlacarCasa] = useState('');
  const [placarFora, setPlacarFora] = useState('');
  // Placar no momento da entrada (só p/ Over Limite +1 — define a linha real apostada)
  const [placarEntradaCasa, setPlacarEntradaCasa] = useState('');
  const [placarEntradaFora, setPlacarEntradaFora] = useState('');
  const [minutoGol, setMinutoGol] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Pré-preenche se já estiver finalizado
  function abrir() {
    if (jaFinalizado && placarAtual) {
      const m = placarAtual.match(/^(\d+)x(\d+)$/);
      if (m) {
        setPlacarCasa(m[1]);
        setPlacarFora(m[2]);
      }
    }
    setAberto(true);
    setErro('');
    setSucesso(false);
  }

  function fechar() {
    if (enviando) return;
    setAberto(false);
    setPlacarCasa('');
    setPlacarFora('');
    setPlacarEntradaCasa('');
    setPlacarEntradaFora('');
    setMinutoGol('');
    setObservacao('');
    setErro('');
    setSucesso(false);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const pc = parseInt(placarCasa, 10);
    const pf = parseInt(placarFora, 10);
    if (isNaN(pc) || pc < 0 || pc > 20) { setErro('Placar da casa inválido (0-20)'); return; }
    if (isNaN(pf) || pf < 0 || pf > 20) { setErro('Placar da fora inválido (0-20)'); return; }

    setEnviando(true);
    // Placar de entrada (opcional, só pra Over Limite +1)
    const pec = placarEntradaCasa.trim() === '' ? null : parseInt(placarEntradaCasa, 10);
    const pef = placarEntradaFora.trim() === '' ? null : parseInt(placarEntradaFora, 10);
    if (pec !== null && (isNaN(pec) || pec < 0 || pec > 20)) { setErro('Placar de entrada (casa) inválido'); setEnviando(false); return; }
    if (pef !== null && (isNaN(pef) || pef < 0 || pef > 20)) { setErro('Placar de entrada (fora) inválido'); setEnviando(false); return; }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          jogo,
          placar_casa: pc,
          placar_fora: pf,
          placar_entrada_casa: pec,
          placar_entrada_fora: pef,
          minuto_gol: minutoGol.trim(),
          observacao: observacao.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.erro) {
        setErro(json.erro || `Falha (status ${res.status})`);
        setEnviando(false);
        return;
      }
      setSucesso(true);
      setEnviando(false);
      // Aguarda 1.5s e recarrega a página pra mostrar atualizações
      setTimeout(() => {
        if (onFinalizado) onFinalizado();
        else window.location.reload();
      }, 1500);
    } catch (e: any) {
      setErro('Erro de rede: ' + (e?.message || 'tente novamente'));
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={
          variante === 'icone'
            ? 'inline-flex items-center justify-center w-7 h-7 rounded text-ink-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition'
            : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition'
        }
        title={jaFinalizado ? 'Editar finalização manual' : 'Finalizar partida'}
      >
        <CheckCircle2 size={variante === 'icone' ? 16 : 13} />
        {variante === 'completo' && (jaFinalizado ? 'Editar' : 'Finalizar')}
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={fechar}
        >
          <div
            className="bg-white dark:bg-ink-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-ink-200 dark:border-ink-800">
              <div>
                <h3 className="font-semibold">Finalizar partida</h3>
                <p className="text-xs text-ink-500 mt-0.5 truncate" title={jogo}>{jogo}</p>
              </div>
              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {sucesso ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Partida finalizada!</p>
                <p className="text-xs text-ink-500 mt-1">Atualizando…</p>
              </div>
            ) : (
              <form onSubmit={enviar} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1.5">
                    Placar final
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0" max="20"
                      value={placarCasa}
                      onChange={(e) => setPlacarCasa(e.target.value)}
                      placeholder="Casa"
                      required
                      disabled={enviando}
                      className="w-20 px-3 py-2 text-center text-lg font-semibold rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    />
                    <span className="text-ink-400 font-bold">x</span>
                    <input
                      type="number"
                      min="0" max="20"
                      value={placarFora}
                      onChange={(e) => setPlacarFora(e.target.value)}
                      placeholder="Fora"
                      required
                      disabled={enviando}
                      className="w-20 px-3 py-2 text-center text-lg font-semibold rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {temOverLimite && (
                  <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 p-3">
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-300 mb-1.5">
                      Placar no momento da entrada <span className="text-purple-500 dark:text-purple-400">(p/ Over Limite)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0" max="20"
                        value={placarEntradaCasa}
                        onChange={(e) => setPlacarEntradaCasa(e.target.value)}
                        placeholder="Casa"
                        disabled={enviando}
                        className="w-16 px-2 py-1.5 text-center font-semibold rounded border border-purple-300 dark:border-purple-800 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className="text-purple-500 font-bold">x</span>
                      <input
                        type="number"
                        min="0" max="20"
                        value={placarEntradaFora}
                        onChange={(e) => setPlacarEntradaFora(e.target.value)}
                        placeholder="Fora"
                        disabled={enviando}
                        className="w-16 px-2 py-1.5 text-center font-semibold rounded border border-purple-300 dark:border-purple-800 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                    </div>
                    <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-1.5 leading-snug">
                      Ex: entrou em 1-0 → linha será Over 1.5. Entrou em 2-1 → Over 3.5. Deixe vazio se não souber.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1.5">
                    Minuto do gol relevante <span className="text-ink-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={minutoGol}
                    onChange={(e) => setMinutoGol(e.target.value)}
                    placeholder="ex: 65, 87+2"
                    maxLength={20}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">
                    Pra Over Limite, registre o minuto do gol que confirmou/derrubou a entrada.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1.5">
                    Observação <span className="text-ink-400">(opcional)</span>
                  </label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="ex: jogo trancou com expulsão aos 70'"
                    rows={2}
                    maxLength={300}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 resize-none"
                  />
                </div>

                {erro && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-3 py-2">
                    {erro}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fechar}
                    disabled={enviando}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-medium border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enviando ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                    {enviando ? 'Enviando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
