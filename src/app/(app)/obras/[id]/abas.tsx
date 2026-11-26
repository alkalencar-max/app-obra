"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Abas({ id }: { id: string }) {
  const caminho = usePathname();
  const abas = [
    { href: `/obras/${id}`, nome: "Dashboard" },
    { href: `/obras/${id}/lancamentos`, nome: "Lançamentos" },
    { href: `/obras/${id}/apropriacoes`, nome: "Etapas e apropriações" },
  ];
  return (
    <nav className="flex gap-1 border-b border-stone-200 text-sm">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`-mb-px border-b-2 px-3 py-2 ${caminho === a.href ? "border-amber-500 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}
