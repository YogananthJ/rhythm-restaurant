import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { PageTransition } from "@/components/PageTransition";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
      <AppNav />
      <PageTransition>
        <Outlet />
      </PageTransition>
    </div>
  );
}
