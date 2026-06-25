"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { TrendingUp, LayoutDashboard, Bookmark, Search, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = query.trim().toUpperCase();
    if (!t) return;
    setOpen(false);
    setQuery("");
    router.push(`/stock/${t}`);
  }

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-40 h-16 bg-[#0f1628]/95 border-b border-slate-700/50 backdrop-blur flex items-center px-6 gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
          <TrendingUp className="w-6 h-6 text-[#c9a84c]" />
          <span className="font-bold text-lg text-white tracking-tight">InvestAI</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                path === href
                  ? "bg-[#c9a84c]/15 text-[#c9a84c]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        {/* Global search trigger */}
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-slate-700 text-slate-400 text-sm hover:border-slate-500 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search ticker…</span>
          <kbd className="ml-2 text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Ctrl K</kbd>
        </button>
      </nav>

      {/* Search modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0f1628] border border-slate-600 rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="flex items-center gap-3 px-4">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                placeholder="Enter ticker symbol (e.g. AAPL)"
                className="flex-1 py-4 bg-transparent text-white placeholder-slate-500 text-lg focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </form>
            <div className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
              Press Enter to view stock · Esc to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
