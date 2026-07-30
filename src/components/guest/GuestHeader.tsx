import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu as MenuIcon, X, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/our-menu", label: "Menu" },
  { to: "/book", label: "Reserve" },
  { to: "/gallery", label: "Gallery" },
  { to: "/reviews", label: "Reviews" },
  { to: "/rewards", label: "Rewards" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function GuestHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-semibold">Occupancy</span>
        </Link>

        <nav aria-label="Guest" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-white/5 hover:text-foreground"
              activeProps={{ className: "bg-primary/12 text-primary" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" className="press hidden sm:inline-flex">
            <Link to="/book">Reserve a table</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav aria-label="Guest mobile" className="drop-in border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm text-foreground/80 hover:bg-white/5 hover:text-foreground"
              activeProps={{ className: "bg-primary/12 text-primary" }}
            >
              {l.label}
            </Link>
          ))}
          <Button asChild className="press mt-2 w-full">
            <Link to="/book" onClick={() => setOpen(false)}>
              Reserve a table
            </Link>
          </Button>
        </nav>
      )}
    </header>
  );
}
