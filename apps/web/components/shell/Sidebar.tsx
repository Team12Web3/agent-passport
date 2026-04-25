import Link from "next/link";
import { Bot, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard?onboard=1", label: "New Agent", icon: Sparkles },
  { href: "/about", label: "Protocol", icon: ShieldCheck }
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 rounded-[28px] border border-black/5 bg-white p-4 shadow-sm lg:block">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-4 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <Bot className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <p className="text-sm font-semibold">Agent Passport</p>
          <p className="text-xs text-slate-300">Avalanche Fuji control plane</p>
        </div>
      </div>
      <nav className="mt-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
