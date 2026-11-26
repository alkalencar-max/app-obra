"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Abas({ id }: { id: string }) {
  const caminho = usePathname();
  const abas = [
    { href: `/obras/${id}`, nome: "Dashboard" },
    { href: `/obras/${id}/orcamento`, nome: "Orçamento" },
    { href: `/obras/${id}/cronograma`, nome: "Cronograma" },
    { href: `/obras/${id}/compras`, nome: "Compras" },
    { href: `/obras/${id}/a-pagar`, nome: "A pagar" },
    { href: `/obras/${id}/lancamentos`, nome: "Lançamentos" },
    { href: `/obras/${id}/relatorio`, nome: "Relatório" },
    { href: `/obras/${id}/apropriacoes`, nome: "Etapas e apropriações" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b-2 border-amber-500 text-sm print:hidden">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`whitespace-nowrap rounded-t-lg px-3 py-2 ${(a.href === `/obras/${id}` ? caminho === a.href : caminho.startsWith(a.href)) ? "bg-amber-500 font-semibold text-stone-950" : "text-stone-600 hover:bg-amber-100 hover:text-stone-900"}`}
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}
