import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, LogOut, Settings as SettingsIcon, ShieldCheck, User } from "lucide-react";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  priority: string;
  read_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "notifications" ? "notifications" : "profile",
  }),
  head: () => ({
    meta: [
      { title: "Profile & Settings — Occupancy" },
      { name: "description", content: "Manage your Occupancy account, role and notification activity." },
      { property: "og:title", content: "Profile & Settings — Occupancy" },
      { property: "og:description", content: "Manage your Occupancy account and notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [restaurant, setRestaurant] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notif[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      setUserId(u.user?.id ?? "");
      const { data: r } = await supabase.from("restaurants").select("id,name").limit(1).maybeSingle();
      setRestaurant((r as { name?: string } | null)?.name ?? null);
      if (u.user?.id) {
        const { data: ur } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        setRoles(((ur as { role: string }[] | null) ?? []).map((x) => x.role));
      }
      const { data: n } = await supabase
        .from("notifications" as never)
        .select("id,title,body,category,priority,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifs((n as unknown as Notif[]) ?? []);
    })();
  }, []);

  async function signOut() {
    const { signOutEverywhere } = await import("@/hooks/use-auth");
    await signOutEverywhere();
    navigate({ to: "/auth" });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex min-w-0 flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">Profile & Settings</h1>
          <p className="text-xs text-muted-foreground">Your account, role and notification activity.</p>
        </div>
      </div>

      <Tabs defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="hover-lift border-white/10 bg-card/70 p-6 backdrop-blur">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" value={email || <Skeleton className="h-4 w-40" />} />
              <Field label="Restaurant" value={restaurant ?? <Skeleton className="h-4 w-32" />} />
              <Field
                label="Roles"
                value={
                  roles.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {roles.map((r) => (
                        <Badge key={r} variant="outline" className="gap-1 border-primary/30 text-primary">
                          <ShieldCheck className="h-3 w-3" /> {r}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No role assigned</span>
                  )
                }
              />
              <Field label="User ID" value={<span className="break-all font-mono text-xs">{userId}</span>} />
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="press">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
              <Button variant="destructive" size="sm" className="press" onClick={() => void signOut()}>
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="border-white/10 bg-card/70 p-0 backdrop-blur">
            {notifs === null ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="skeleton-shine h-12 w-full" />
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {notifs.map((n) => (
                  <li key={n.id} className="row-hover flex min-w-0 gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        <span className="truncate text-sm font-medium">{n.title}</span>
                      </div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                    <Badge variant="outline" className="h-5 shrink-0 self-start border-white/10 text-[10px]">
                      {n.category}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm">{value}</dd>
    </div>
  );
}
