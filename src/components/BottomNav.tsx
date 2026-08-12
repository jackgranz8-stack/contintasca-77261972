import { Link, useRouterState } from "@tanstack/react-router";
import { Home, List, PieChart, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/storico", label: "Storico", icon: List },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/profilo", label: "Profilo", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center bg-background/85 backdrop-blur-xl">
      <div className="w-full max-w-[430px] border-t border-border px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)]">
        <ul className="flex items-stretch justify-between">
          {items.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
