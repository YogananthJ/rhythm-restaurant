import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-surface/30 px-6 py-14 text-center ${className}`}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl" aria-hidden="true" />
        <div className="float-slow grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button asChild={!!action.href} className="press mt-5" onClick={action.onClick}>
          {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
        </Button>
      )}
    </div>
  );
}
