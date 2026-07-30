import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationsBell } from "@/components/NotificationsBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BarChart3,
  Bell,
  Bot,
  Brain,
  CalendarPlus,
  ChefHat,
  ChevronDown,
  Cpu,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  QrCode,
  Receipt,
  Settings,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

export const NAV_GROUPS: Group[] = [
  {
    id: "operations",
    label: "Operations",
    icon: Utensils,
    items: [
      { to: "/host", label: "Host", icon: Users },
      { to: "/book", label: "Reserve a Table", icon: CalendarPlus },
      { to: "/tables", label: "QR Ordering", icon: QrCode },
      { to: "/menu", label: "Menu", icon: Utensils },
      { to: "/kds", label: "Kitchen Display", icon: ChefHat },
      { to: "/billing", label: "Billing", icon: Receipt },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      { to: "/reports", label: "Reports", icon: FileText },
      { to: "/intel", label: "Intel", icon: Brain },
      { to: "/insights", label: "Insights", icon: Gauge },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
    items: [
      { to: "/ops", label: "Copilot", icon: Sparkles },
      { to: "/autopilot", label: "Autopilot", icon: Cpu },
    ],
  },
];

// Cache these once per browser session — the nav mounts on every authenticated
// route change and previously refetched the user + restaurant each time.
let restaurantIdPromise: Promise<string | null> | null = null;
function loadRestaurantId(): Promise<string | null> {
  if (!restaurantIdPromise) {
    restaurantIdPromise = Promise.resolve(
      supabase.from("restaurants").select("id").limit(1).maybeSingle(),
    ).then(({ data }) => data?.id ?? null);
  }
  return restaurantIdPromise;
}

export function AppNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? "");
    });
    void loadRestaurantId().then((id) => {
      if (alive && id) setRestaurantId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    const { signOutEverywhere } = await import("@/hooks/use-auth");
    await signOutEverywhere();
    navigate({ to: "/auth" });
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const groupActive = (g: Group) => g.items.some((i) => isActive(i.to));

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6"
      >
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <ChefHat className="h-4 w-4" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-semibold leading-none">Occupancy</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Restaurant nerve center</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="ml-4 hidden min-w-0 items-center gap-1 lg:flex">
          <Link
            to="/dashboard"
            className={`nav-item flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm font-medium ${
              isActive("/dashboard") ? "nav-item-active" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={isActive("/dashboard") ? "page" : undefined}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
            {isActive("/dashboard") && (
              <span className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-primary" />
            )}
          </Link>

          {NAV_GROUPS.map((g) => {
            const active = groupActive(g);
            return (
              <DropdownMenu key={g.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`nav-item group flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "nav-item-active" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <g.icon className="h-4 w-4" />
                    {g.label}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    {active && <span className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-primary" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={10}
                  className="w-56 rounded-xl border-white/10 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </DropdownMenuLabel>
                  {g.items.map((i) => (
                    <DropdownMenuItem key={i.to} asChild>
                      <Link
                        to={i.to}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                          isActive(i.to) ? "text-primary" : ""
                        }`}
                      >
                        <i.icon className="h-4 w-4" />
                        {i.label}
                        {isActive(i.to) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Realtime
          </Badge>

          <NotificationsBell restaurantId={restaurantId} />

          {/* Account (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="press hidden lg:inline-flex" aria-label="Account menu">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {(email[0] ?? "U").toUpperCase()}
                </span>
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="w-60 rounded-xl border-white/10 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {email || "Signed in"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" search={{ tab: "notifications" }} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm">
                  <Bell className="h-4 w-4" /> Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm">
                  <Settings className="h-4 w-4" /> Profile / Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()} className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-sm">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden" aria-label="Open navigation menu">
                <MenuIcon className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full border-white/10 bg-card/95 backdrop-blur-xl sm:max-w-sm"
              aria-label="Navigation menu"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" /> Occupancy
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Browse operations, analytics, AI and account sections. Press Escape to close.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-2 overflow-y-auto px-4 pb-8">
                <Link
                  to="/dashboard"
                  aria-current={isActive("/dashboard") ? "page" : undefined}
                  className={`nav-item mb-2 flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium ${
                    isActive("/dashboard") ? "nav-item-active" : "text-muted-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>

                <Accordion type="multiple" defaultValue={NAV_GROUPS.filter(groupActive).map((g) => g.id)}>
                  {NAV_GROUPS.map((g) => (
                    <AccordionItem key={g.id} value={g.id} className="border-white/10">
                      <AccordionTrigger className="py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <g.icon className="h-4 w-4" /> {g.label}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <div className="flex flex-col gap-1">
                          {g.items.map((i) => (
                            <Link
                              key={i.to}
                              to={i.to}
                              className={`nav-item flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm ${
                                isActive(i.to) ? "nav-item-active" : "text-muted-foreground"
                              }`}
                            >
                              <i.icon className="h-4 w-4" /> {i.label}
                            </Link>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}

                  <AccordionItem value="account" className="border-white/10">
                    <AccordionTrigger className="py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Account
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="flex flex-col gap-1">
                        <Link
                          to="/settings"
                          search={{ tab: "notifications" }}
                          className="nav-item flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground"
                        >
                          <Bell className="h-4 w-4" /> Notifications
                        </Link>
                        <Link
                          to="/settings"
                          className="nav-item flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground"
                        >
                          <Settings className="h-4 w-4" /> Profile / Settings
                        </Link>
                        <button
                          onClick={() => void signOut()}
                          className="nav-item flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground"
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {email && <p className="mt-4 truncate text-xs text-muted-foreground">{email}</p>}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
