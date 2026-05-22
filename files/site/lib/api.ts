/**
 * Cliente da API de trades (Cloudflare Worker).
 * A URL da API vem da variável de ambiente NEXT_PUBLIC_API_URL.
 */

export type TradeInput = {
  id?: string;
  data: string;
  jogo: string;
  liga?: string;
  metodo: string;
  mercado: string;
  odd_entrada: number;
  odd_saida?: number;
  stake_pct: number;
  resultado: 'green' | 'red' | 'pendente';
  criterios_atendidos: boolean;
  observacoes?: string;
};

function apiUrl(path: string = ''): string {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) {
    throw new Error(
      'NEXT_PUBLIC_API_URL não configurado. Adicione no .env.local ou nas variáveis do Cloudflare Pages.'
    );
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function apiCriarTrade(trade: TradeInput) {
  const r = await fetch(apiUrl('/trades'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade),
  });
  if (!r.ok) throw new Error((await r.json()).erro || `Falha ${r.status}`);
  return r.json();
}

export async function apiEditarTrade(id: string, trade: Partial<TradeInput>) {
  const r = await fetch(apiUrl(`/trades/${encodeURIComponent(id)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade),
  });
  if (!r.ok) throw new Error((await r.json()).erro || `Falha ${r.status}`);
  return r.json();
}

export async function apiDeletarTrade(id: string) {
  const r = await fetch(apiUrl(`/trades/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!r.ok) throw new Error((await r.json()).erro || `Falha ${r.status}`);
  return r.json();
}

export async function apiRodarAuditoria() {
  const r = await fetch(apiUrl('/auditar'), {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) throw new Error((await r.json()).erro || `Falha ${r.status}`);
  return r.json();
}

export function temApi(): boolean {
  return !!process.env.NEXT_PUBLIC_API_URL;
}
