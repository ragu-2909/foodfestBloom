import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/vote", label: "Vote" },
  { to: "/display", label: "Live Results" }
];

export function PublicNav() {
  return (
    <nav className="mb-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1.5 backdrop-blur">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "rounded-full px-4 py-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white",
              isActive && "bg-white/20 text-white"
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
