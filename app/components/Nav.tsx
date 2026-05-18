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
      <div className="ml-auto flex items-stretch">
        <a
          href="https://www.instagram.com/agenteperrylatam/"
          target="_blank"
          rel="noopener noreferrer"
          className="border-l border-white px-5 py-4 opacity-50 hover:opacity-100 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
          aria-label="Instagram @agenteperrylatam"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="4.5"/>
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span className="hidden md:inline">@agenteperrylatam</span>
        </a>
      </div>
    </nav>
  );
}
