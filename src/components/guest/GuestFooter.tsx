import { Link } from "@tanstack/react-router";
import { CONTACT } from "@/lib/guest-catalog";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const LINKS = [
  { to: "/our-menu", label: "Menu" },
  { to: "/book", label: "Reserve a table" },
  { to: "/gallery", label: "Gallery" },
  { to: "/reviews", label: "Guest reviews" },
  { to: "/rewards", label: "Rewards hub" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/profile", label: "My profile" },
] as const;

export function GuestFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <div className="text-sm font-semibold">{CONTACT.name}</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{CONTACT.address}</li>
            <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="hover:text-foreground">{CONTACT.phone}</a></li>
            <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><a href={`mailto:${CONTACT.email}`} className="hover:text-foreground">{CONTACT.email}</a></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening hours</div>
          <ul className="mt-3 space-y-2 text-sm">
            {CONTACT.hours.map((h) => (
              <li key={h.day} className="flex items-center justify-between gap-3 text-muted-foreground">
                <span className="flex min-w-0 items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{h.day}</span></span>
                <span className="shrink-0 text-foreground/85">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explore</div>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="flex min-h-10 items-center text-foreground/80 hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {CONTACT.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground">
          © 2026 Occupancy · Live kitchen-to-table intelligence
        </div>
      </div>
    </footer>
  );
}
