"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "INICIO" },
  { href: "/alertas", label: "ALERTAS" },
  { href: "/entidades", label: "ENTIDADES" },
  { href: "/grafo", label: "GRAFO" },
  { href: "/metodologia", label: "METODOLOGÍA" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-white flex items-stretch text-xs tracking-widest">
      <Link
        href="/"
        className="border-r border-white px-6 py-4 font-black text-sm shrink-0 hover:bg-white hover:text-black transition-colors"
      >
        P.E.R.R.Y
      </Link>
      <div className="flex items-stretch flex-1">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`border-r border-white px-5 py-4 transition-colors hover:bg-white hover:text-black ${
                active ? "bg-white text-black" : ""
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto px-6 py-4 opacity-30 text-xs hidden md:flex items-center">
        KNOWLEDGE GRAPH ANTICORRUPCIÓN · PERÚ 2024-2026
      </div>
    </nav>
  );
}
