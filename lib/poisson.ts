// Cálculo de probabilidades de placar via distribuição de Poisson.
// P(gols = k | λ) = (λ^k × e^(-λ)) / k!
// Assumindo independência entre os gols dos 2 times:
// P(placar X-Y) = P_casa(X) × P_fora(Y)

const MAX_GOLS = 6; // calcula até 6x6 (suficiente: prob > 99% já coberta)

function poissonProb(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // P(k|λ) = (λ^k × e^(-λ)) / k!
  let fat = 1;
  for (let i = 2; i <= k; i++) fat *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fat;
}

export type PlacarProvavel = {
  placar: string; // ex: "2-1"
  gols_casa: number;
  gols_fora: number;
  prob: number;   // 0-1
  prob_pct: number; // 0-100, arredondado
};

/**
 * Calcula os N placares mais prováveis a partir das médias de gols de cada time.
 * Retorna lista ordenada por probabilidade decrescente.
 * Se as médias não forem válidas (NaN, <= 0), retorna lista vazia.
 */
export function calcularPlacaresMaisProvaveis(
  mediaCasa: number,
  mediaFora: number,
  n: number = 4
): PlacarProvavel[] {
  if (!Number.isFinite(mediaCasa) || !Number.isFinite(mediaFora)) return [];
  if (mediaCasa <= 0 || mediaFora <= 0) return [];
  // Limites de segurança (médias acima de 5 são impossíveis na prática)
  if (mediaCasa > 6 || mediaFora > 6) return [];

  // Pré-calcula prob de cada número de gols pra casa e fora
  const probsCasa: number[] = [];
  const probsFora: number[] = [];
  for (let k = 0; k <= MAX_GOLS; k++) {
    probsCasa.push(poissonProb(k, mediaCasa));
    probsFora.push(poissonProb(k, mediaFora));
  }

  // Gera todos os placares possíveis
  const placares: PlacarProvavel[] = [];
  for (let c = 0; c <= MAX_GOLS; c++) {
    for (let f = 0; f <= MAX_GOLS; f++) {
      const prob = probsCasa[c] * probsFora[f];
      placares.push({
        placar: `${c}-${f}`,
        gols_casa: c,
        gols_fora: f,
        prob,
        prob_pct: Math.round(prob * 100),
      });
    }
  }

  // Ordena por probabilidade desc e pega os top N
  placares.sort((a, b) => b.prob - a.prob);
  return placares.slice(0, n);
}

/**
 * Parser tolerante de média de gols.
 * Aceita: 1.8, "1.8", "1,8", "1.8 gols/jogo", null.
 * Retorna número ou null se inválido.
 */
export function parseMediaGols(valor: unknown): number | null {
  if (valor == null) return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor !== 'string') return null;
  const m = valor.match(/(\d+([.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
