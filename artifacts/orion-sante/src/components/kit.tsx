import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS, VISIT_STATUS, errMsg } from "@/lib/fmt";

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6 rise">
      <div>
        {eyebrow && <div className="label-s mb-1.5 text-saffron">{eyebrow}</div>}
        <h1 className="text-[1.9rem] leading-tight font-semibold" data-testid="text-page-title">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "ink", testId, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ink" | "saffron" | "lagoon" | "danger"; testId?: string; className?: string }) {
  const bar = { ink: "bg-ink", saffron: "bg-saffron", lagoon: "bg-lagoon", danger: "bg-destructive" }[tone];
  return (
    <div className={cn("panel p-4 relative overflow-hidden rise", className)} data-testid={testId}>
      <span className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r", bar)} />
      <div className="label-s">{label}</div>
      <div className="num text-[1.45rem] font-semibold mt-1.5 leading-none">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

const visitTone: Record<string, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  waiting: "bg-accent text-accent-foreground",
  in_progress: "bg-ink text-primary-foreground",
  completed: "bg-lagoon/12 text-lagoon",
  cancelled: "bg-muted text-muted-foreground line-through",
};
export function VisitBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", visitTone[status])}>
      {status === "in_progress" && <span className="size-1.5 rounded-full bg-saffron pulse-dot" />}
      {VISIT_STATUS[status] ?? status}
    </span>
  );
}

const invTone: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-accent text-accent-foreground",
  paid: "bg-lagoon/12 text-lagoon",
};
export function InvoiceBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", invTone[status])}>{INVOICE_STATUS[status] ?? status}</span>;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="relative mb-4">
        <div className="size-12 rounded-2xl bg-accent text-accent-foreground grid place-items-center">{icon}</div>
        <span className="absolute -right-2 -top-1 size-1.5 rounded-full bg-saffron" />
        <span className="absolute -left-3 bottom-0 size-1 rounded-full bg-ink/40" />
      </div>
      <div className="font-display font-semibold">{title}</div>
      {text && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="panel p-8 flex flex-col items-center text-center">
      <AlertTriangle className="size-6 text-destructive mb-3" />
      <div className="font-display font-semibold">Impossible de charger les données</div>
      <p className="text-sm text-muted-foreground mt-1">{errMsg(error)}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry} data-testid="button-retry">
        <RotateCw className="size-4 mr-2" /> Réessayer
      </Button>
    </div>
  );
}

export function Sk({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted animate-pulse", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Sk className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-24" />)}
      </div>
      <Sk className="h-72" />
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground mt-1 block">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: NoInfer<T>) => void; items: { value: NoInfer<T>; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-secondary gap-1 flex-wrap">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          data-testid={`tab-${it.value}`}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm transition-all",
            value === it.value ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="num ml-1.5 text-xs opacity-70">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
