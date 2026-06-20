'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiCriarTrade, apiEditarTrade, apiDeletarTrade, temApi } from '@/lib/api';
import type { TradeInput } from '@/lib/api';

type SugestaoJogo = {
  jogo: string;
  liga?: string;
  horario?: string;
  data: string;
  mercado_sugerido?: string;
  odd_sugerida?: string;
  stake_sugerida?: string;
};

const METODOS = [
  'Back Favorito',
  'Lay Zebra',
  'Over Limite (+1 gol)',
  'Back 2x2',
  'Back Goleada',
  'Lay 1×0',
  'Lay 0×1',
  'Confirmação Visual',
  'Outro',
];

type Props = {
  modoEdicao?: boolean;
  tradeInicial?: Partial<TradeInput>;
  sugestoes: SugestaoJogo[];
};

export default function FormularioTrade({ modoEdicao = false, tradeInicial, sugestoes }: Props) {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);

  const [data, setData] = useState(tradeInicial?.data || hoje);
  const [jogo, setJogo] = useState(tradeInicial?.jogo || '');
  const [liga, setLiga] = useState(tradeInicial?.liga || '');
  const [metodo, setMetodo] = useState(tradeInicial?.metodo || METODOS[0]);
  const [mercado, setMercado] = useState(tradeInicial?.mercado || '');
  const [oddEntrada, setOddEntrada] = useState<string>(
    tradeInicial?.odd_entrada?.toString() || ''
  );
  const [oddSaida, setOddSaida] = useState<string>(
    tradeInicial?.odd_saida?.toString() || ''
  );
  const [stakePct, setStakePct] = useState<string>(
    tradeInicial?.stake_pct?.toString() || ''
  );
  const [resultado, setResultado] = useState<'green' | 'red' | 'pendente'>(
    tradeInicial?.resultado || 'pendente'
  );
  const [criteriosAtendidos, setCriteriosAtendidos] = useState(
    tradeInicial?.criterios_atendidos ?? true
  );
  const [observacoes, setObservacoes] = useState(tradeInicial?.observacoes || '');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const sugestoesFiltradas = useMemo(() => {
    if (!jogo) return sugestoes.slice(0, 10);
    const lower = jogo.toLowerCase();
    return sugestoes
      .filter((s) => s.jogo.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [jogo, sugestoes]);

  const apiDisponivel = temApi();

  function aplicarSugestao(s: SugestaoJogo) {
    setJogo(s.jogo);
    if (s.liga) setLiga(s.liga);
    if (s.data) setData(s.data);
    if (s.mercado_sugerido) setMercado(s.mercado_sugerido);
    if (s.odd_sugerida) setOddEntrada(s.odd_sugerida.replace(',', '.'));
    if (s.stake_sugerida) {
      const num = s.stake_sugerida.replace(/[^\d.,]/g, '').replace(',', '.');
      setStakePct(num);
    }
    setMostrarSugestoes(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    const oddE = parseFloat(oddEntrada.replace(',', '.'));
    const oddS = oddSaida ? parseFloat(oddSaida.replace(',', '.')) : undefined;
    const stake = parseFloat(stakePct.replace(',', '.'));

    if (isNaN(oddE) || oddE <= 1) {
      setErro('ODD de entrada deve ser número maior que 1');
      return;
    }
    if (isNaN(stake) || stake <= 0) {
      setErro('Stake deve ser número maior que 0');
      return;
    }
    if (!jogo.trim() || !mercado.trim()) {
      setErro('Jogo e mercado são obrigatórios');
      return;
    }

    const payload: TradeInput = {
      data,
      jogo: jogo.trim(),
      liga: liga.trim() || undefined,
      metodo,
      mercado: mercado.trim(),
      odd_entrada: oddE,
      odd_saida: oddS,
      stake_pct: stake,
      resultado,
      criterios_atendidos: criteriosAtendidos,
      observacoes: observacoes.trim() || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && tradeInicial?.id) {
        await apiEditarTrade(tradeInicial.id, payload);
      } else {
        await apiCriarTrade(payload);
      }
      setSucesso(true);
      setTimeout(() => {
        router.push('/auditoria/');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErro(err.message || 'Erro desconhecido');
    } finally {
      setSalvando(false);
    }
  }

  async function deletar() {
    if (!modoEdicao || !tradeInicial?.id) return;
    if (!confirm(`Tem certeza que quer deletar este trade?`)) return;
    setSalvando(true);
    setErro(null);
    try {
      await apiDeletarTrade(tradeInicial.id);
      router.push('/auditoria/');
      router.refresh();
    } catch (err: any) {
      setErro(err.message || 'Erro desconhecido');
      setSalvando(false);
    }
  }

  if (!apiDisponivel) {
    return (
      <div className="card p-6 ring-1 ring-amber-200 dark:ring-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold mb-1">API não configurada</h3>
            <p className="text-sm text-ink-600 dark:text-ink-400 mb-3">
              Pra usar o formulário de registro, você precisa configurar o Worker do Cloudflare
              e adicionar a URL dele na variável <code className="text-xs bg-ink-100 dark:bg-ink-800 px-1 py-0.5 rounded">NEXT_PUBLIC_API_URL</code> nas configurações
              do Cloudflare Pages.
            </p>
            <p className="text-sm text-ink-600 dark:text-ink-400">
              Veja as instruções no <code className="text-xs">README.md</code> da pasta <code className="text-xs">worker/</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {/* Linha 1: data e jogo (autocomplete) */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Data
          </label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div className="sm:col-span-2 relative">
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Jogo {sugestoes.length > 0 && <span className="text-ink-400 normal-case">(digite ou escolha um analisado)</span>}
          </label>
          <input
            type="text"
            value={jogo}
            onChange={(e) => {
              setJogo(e.target.value);
              setMostrarSugestoes(true);
            }}
            onFocus={() => setMostrarSugestoes(true)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
            placeholder="Time A x Time B"
            required
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />

          {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {sugestoesFiltradas.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => aplicarSugestao(s)}
                  className="w-full px-3 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-800 transition border-b border-ink-100 dark:border-ink-800 last:border-0"
                >
                  <div className="font-medium text-sm">{s.jogo}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5">
                    {s.horario && <span className="font-mono">{s.horario}</span>}
                    {s.liga && <span>· {s.liga}</span>}
                    {s.mercado_sugerido && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        · {s.mercado_sugerido}{s.odd_sugerida ? ` @ ${s.odd_sugerida}` : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Linha 2: liga e método */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Liga
          </label>
          <input
            type="text"
            value={liga}
            onChange={(e) => setLiga(e.target.value)}
            placeholder="ex: Premier League"
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Método
          </label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition"
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 3: mercado */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
          Mercado
        </label>
        <input
          type="text"
          value={mercado}
          onChange={(e) => setMercado(e.target.value)}
          placeholder="ex: Mais 2.5 gols"
          required
          className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition"
        />
      </div>

      {/* Linha 4: odds e stake */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            ODD entrada
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={oddEntrada}
            onChange={(e) => setOddEntrada(e.target.value)}
            placeholder="1.85"
            required
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            ODD saída <span className="text-ink-400 normal-case">(opcional)</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={oddSaida}
            onChange={(e) => setOddSaida(e.target.value)}
            placeholder="—"
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Stake (%)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={stakePct}
            onChange={(e) => setStakePct(e.target.value)}
            placeholder="2"
            required
            className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition tabular-nums"
          />
        </div>
      </div>

      {/* Resultado e critérios — botões */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Resultado
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setResultado('pendente')}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm ${
                resultado === 'pendente'
                  ? 'bg-amber-500 text-white'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              Pendente
            </button>
            <button
              type="button"
              onClick={() => setResultado('green')}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm ${
                resultado === 'green'
                  ? 'bg-emerald-600 text-white'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              Green
            </button>
            <button
              type="button"
              onClick={() => setResultado('red')}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm ${
                resultado === 'red'
                  ? 'bg-red-600 text-white'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              Red
            </button>
          </div>
          {resultado === 'pendente' && (
            <p className="text-[11px] text-ink-500 mt-1">
              A auditoria automática vai marcar Green/Red quando o jogo terminar.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Critérios atendidos?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCriteriosAtendidos(true)}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                criteriosAtendidos
                  ? 'bg-blue-600 text-white'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setCriteriosAtendidos(false)}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                !criteriosAtendidos
                  ? 'bg-amber-600 text-white'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              Não
            </button>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
          Observações
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="O que aconteceu? Por que esse resultado?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 focus:ring-2 focus:ring-blue-500 outline-none transition resize-y"
        />
      </div>

      {erro && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-900 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">{erro}</div>
        </div>
      )}

      {sucesso && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-900 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">Trade salvo. Redirecionando…</div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={salvando}
          className="btn btn-primary disabled:opacity-50"
        >
          <Save size={16} />
          {salvando ? 'Salvando…' : modoEdicao ? 'Salvar alterações' : 'Registrar trade'}
        </button>

        {modoEdicao && (
          <button
            type="button"
            onClick={deletar}
            disabled={salvando}
            className="btn bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Deletar
          </button>
        )}

        <Link href="/auditoria/" className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
