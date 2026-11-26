import Link from "next/link";
import { sair } from "@/app/login/acoes";
import { exigirEmpresa } from "@/lib/sessao";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { empresaNome, email } = await exigirEmpresa();
  return (
    <div className="min-h-screen">
      <header className="print:hidden border-b-4 border-amber-500 bg-stone-900 pt-[env(safe-area-inset-top)] text-stone-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="font-bold text-amber-400">
            App Obra
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="hover:text-amber-300">Obras</Link>
            <Link href="/importar" className="hover:text-amber-300">Importar planilha</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-stone-400">
            <span className="hidden sm:inline">{empresaNome} · {email}</span>
            <form action={sair}>
              <button className="rounded border border-stone-600 px-2 py-1 hover:bg-stone-800">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
