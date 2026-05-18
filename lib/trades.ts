import fs from 'node:fs';
import path from 'node:path';

export type Trade = {
  id: string;                    // ID único do trade
  data: string;                  // YYYY-MM-DD
  jogo: string;                  // Time A x Time B
  liga?: string;
  metodo: string;                // "Pré-jogo Over", "Over Limite 70+", "Confirmação Visual", etc.
  mercado: string;               // ex: "Mais 2.5 gols"
  odd_entrada: number;
  odd_saida?: number;            // se cash-out parcial; senão deixa em branco
  stake_pct: number;             // ex: 2 (significa 2%)
  resultado: 'green' | 'red';    // ganhou ou perdeu
  criterios_atendidos: boolean;  // o método foi seguido à risca?
  observacoes?: string;
  trader?: string;               // opcional: nome do trader (no caso de grupo)
};

export type TradeEnriquecido = Trade & {
  classificacao_tecnica: 'correct_green' | 'correct_red' | 'false_green' | 'false_red';
  lucro_unidades: number;        // em unidades de stake (1 unidade = 1% da banca)
};

export type Estatisticas = {
  total_trades: number;
  total_greens: number;
  total_reds: number;
  taxa_acerto: number;          // % de greens

  // Estatísticas técnicas (cumprimento de método)
  correct_greens: number;
  correct_reds: number;
  false_greens: number;
  false_reds: number;
  taxa_tecnica: number;          // % com critérios_atendidos = true

  // Resultado financeiro
  lucro_unidades: number;        // total acumulado em unidades
  roi_pct: number;               // (lucro / total stakes) * 100

  // Drawdown
  drawdown_max: number;          // queda máxima do pico (em unidades)
  pico_acumulado: number;        // melhor momento

  // Por dia
  melhor_dia: { data: string; lucro: number } | null;
  pior_dia: { data: string; lucro: number } | null;

  // Por método
  por_metodo: Record<string, { trades: number; lucro: number; taxa_acerto: number }>;

  // Evolução temporal (pra gráfico simples)
  curva_acumulada: { data: string; saldo: number }[];
};

const TRADES_PATH = path.join(process.cwd(), 'relatorios', 'trades.json');

export function listarTrades(): TradeEnriquecido[] {
  if (!fs.existsSync(TRADES_PATH)) return [];
  try {
    const raw = fs.readFileSync(TRADES_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const trades: Trade[] = Array.isArray(data) ? data : (data.trades || []);
    return trades.map(enriquecer).sort((a, b) => b.data.localeCompare(a.data));
  } catch {
    return [];
  }
}

function enriquecer(t: Trade): TradeEnriquecido {
  // Lucro: se green = stake * (odd - 1), se red = -stake
  const lucro_unidades = t.resultado === 'green'
    ? t.stake_pct * (t.odd_entrada - 1)
    : -t.stake_pct;

  let classificacao: TradeEnriquecido['classificacao_tecnica'];
  if (t.criterios_atendidos && t.resultado === 'green') classificacao = 'correct_green';
  else if (t.criterios_atendidos && t.resultado === 'red') classificacao = 'correct_red';
  else if (!t.criterios_atendidos && t.resultado === 'green') classificacao = 'false_green';
  else classificacao = 'false_red';

  return { ...t, classificacao_tecnica: classificacao, lucro_unidades };
}

export function calcularEstatisticas(trades: TradeEnriquecido[]): Estatisticas {
  if (trades.length === 0) {
    return {
      total_trades: 0, total_greens: 0, total_reds: 0, taxa_acerto: 0,
      correct_greens: 0, correct_reds: 0, false_greens: 0, false_reds: 0, taxa_tecnica: 0,
      lucro_unidades: 0, roi_pct: 0,
      drawdown_max: 0, pico_acumulado: 0,
      melhor_dia: null, pior_dia: null,
      por_metodo: {}, curva_acumulada: [],
    };
  }

  const total = trades.length;
  const greens = trades.filter(t => t.resultado === 'green').length;
  const reds = total - greens;

  const correct_greens = trades.filter(t => t.classificacao_tecnica === 'correct_green').length;
  const correct_reds = trades.filter(t => t.classificacao_tecnica === 'correct_red').length;
  const false_greens = trades.filter(t => t.classificacao_tecnica === 'false_green').length;
  const false_reds = trades.filter(t => t.classificacao_tecnica === 'false_red').length;
  const com_criterios = trades.filter(t => t.criterios_atendidos).length;

  const lucro_total = trades.reduce((acc, t) => acc + t.lucro_unidades, 0);
  const stakes_total = trades.reduce((acc, t) => acc + t.stake_pct, 0);

  // Curva acumulada (ordem cronológica)
  const tradesCronologico = [...trades].sort((a, b) => a.data.localeCompare(b.data));
  let saldo = 0;
  let pico = 0;
  let drawdown_max = 0;
  const curva: { data: string; saldo: number }[] = [];
  for (const t of tradesCronologico) {
    saldo += t.lucro_unidades;
    if (saldo > pico) pico = saldo;
    const dd = pico - saldo;
    if (dd > drawdown_max) drawdown_max = dd;
    curva.push({ data: t.data, saldo: Math.round(saldo * 100) / 100 });
  }

  // Por dia
  const porDia = new Map<string, number>();
  for (const t of trades) {
    porDia.set(t.data, (porDia.get(t.data) || 0) + t.lucro_unidades);
  }
  let melhor_dia: Estatisticas['melhor_dia'] = null;
  let pior_dia: Estatisticas['pior_dia'] = null;
  for (const [data, lucro] of porDia.entries()) {
    if (!melhor_dia || lucro > melhor_dia.lucro) melhor_dia = { data, lucro: Math.round(lucro * 100) / 100 };
    if (!pior_dia || lucro < pior_dia.lucro) pior_dia = { data, lucro: Math.round(lucro * 100) / 100 };
  }

  // Por método
  const porMetodo: Estatisticas['por_metodo'] = {};
  for (const t of trades) {
    if (!porMetodo[t.metodo]) {
      porMetodo[t.metodo] = { trades: 0, lucro: 0, taxa_acerto: 0 };
    }
    porMetodo[t.metodo].trades++;
    porMetodo[t.metodo].lucro += t.lucro_unidades;
  }
  for (const m of Object.keys(porMetodo)) {
    const greensDoMetodo = trades.filter(t => t.metodo === m && t.resultado === 'green').length;
    porMetodo[m].taxa_acerto = Math.round((greensDoMetodo / porMetodo[m].trades) * 1000) / 10;
    porMetodo[m].lucro = Math.round(porMetodo[m].lucro * 100) / 100;
  }

  return {
    total_trades: total,
    total_greens: greens,
    total_reds: reds,
    taxa_acerto: Math.round((greens / total) * 1000) / 10,
    correct_greens, correct_reds, false_greens, false_reds,
    taxa_tecnica: Math.round((com_criterios / total) * 1000) / 10,
    lucro_unidades: Math.round(lucro_total * 100) / 100,
    roi_pct: stakes_total > 0 ? Math.round((lucro_total / stakes_total) * 1000) / 10 : 0,
    drawdown_max: Math.round(drawdown_max * 100) / 100,
    pico_acumulado: Math.round(pico * 100) / 100,
    melhor_dia, pior_dia, por_metodo: porMetodo, curva_acumulada: curva,
  };
}
