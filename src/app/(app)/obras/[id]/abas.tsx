"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Abas({ id }: { id: string }) {
  const caminho = usePathname();
  const abas = [
    { href: `/obras/${id}`, nome: "Dashboard" },
    { href: `/obras/${id}/lancamentos`, nome: "Lançamentos" },
    { href: `/obras/${id}/compras`, nome: "Compras" },
    { href: `/obras/${id}/a-pagar`, nome: "A pagar" },
    { href: `/obras/${id}/apropriacoes`, nome: "Etapas e apropriações" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 text-sm print:hidden">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${(a.href === `/obras/${id}` ? caminho === a.href : caminho.startsWith(a.href)) ? "border-amber-500 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}
