'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRodarAuditoria, temApi } from '@/lib/api';

export default function BotaoAuditar() {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  if (!temApi()) return null;

  async function rodar() {
    setRodando(true);
    setResultado(null);
    try {
      const r = await apiRodarAuditoria();
      const msg = r.atualizados > 0
        ? `${r.atualizados} trade(s) atualizado(s) · ${r.inconclusivos || 0} inconclusivo(s)`
        : r.status === 'sem_pendentes'
          ? 'Nenhum trade pendente'
          : `Sem mudanças (${r.inconclusivos || 0} inconclusivo(s))`;
      setResultado({ tipo: 'ok', texto: msg });
      setTimeout(() => { router.refresh(); }, 2000);
    } catch (err: any) {
      setResultado({ tipo: 'erro', texto: err.message || 'Erro desconhecido' });
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={rodar}
        disabled={rodando}
        className="btn btn-secondary disabled:opacity-50"
      >
        <RefreshCw size={14} className={rodando ? 'animate-spin' : ''} />
        {rodando ? 'Auditando…' : 'Auditar agora'}
      </button>
      {resultado && (
        <div className={`text-xs flex items-center gap-1 ${
          resultado.tipo === 'ok'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          {resultado.tipo === 'ok' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
          {resultado.texto}
        </div>
      )}
    </div>
  );
}
