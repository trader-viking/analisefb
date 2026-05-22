import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-3xl font-bold mb-2">Relatório não encontrado</h1>
      <p className="text-ink-500 mb-6">O relatório pedido não existe ou foi removido.</p>
      <Link
        href="/"
        className="inline-block px-4 py-2 rounded-md bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-900 hover:opacity-80 transition"
      >
        Voltar à página inicial
      </Link>
    </div>
  );
}
