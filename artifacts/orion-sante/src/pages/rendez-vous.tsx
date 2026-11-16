import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Pencil, X } from "lucide-react";
import type { Visit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, PageHeader, PageSkeleton, VisitBadge } from "@/components/kit";
import { VisitDialog } from "@/components/dialogs";
import { useVisitStatus } from "@/pages/consultations";
import { LOC, TZ, addDays, dayKey, fDateLong, fTime, fullName, todayKey } from "@/lib/fmt";
import { cn } from "@/lib/utils";

const weekStart = (key: string) => {
  const d = new Date(`${key}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(key, -wd);
};

export default function RendezVous() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const { setStatus, busy } = useVisitStatus();
  const [day, setDay] = useState(todayKey());
  const [dlg, setDlg] = useState<{ open: boolean; visit: Visit | null }>({ open: false, visit: null });
  const start = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const byDay = useMemo(() => {
    const m = new Map<string, Visit[]>();
    ws?.visits.forEach((v) => { const k = dayKey(v.scheduledAt); m.set(k, [...(m.get(k) ?? []), v]); });
    m.forEach((l) => l.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
    return m;
  }, [ws]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;
  const list = byDay.get(day) ?? [];
  const pOf = (id: string) => ws.patients.find((p) => p.id === id);
  const defaultAt = `${day}T09:00:00.000Z`;

  return (
    <div>
      <PageHeader eyebrow="Agenda" title="Rendez-vous" sub="Planifiez les visites ; à l'arrivée du patient, il rejoint la file d'attente."
        actions={<Button onClick={() => setDlg({ open: true, visit: null })} data-testid="button-new-appointment"><Plus className="size-4 mr-1.5" /> Nouveau rendez-vous</Button>} />

      <div className="panel p-3 mb-3 rise">
        <div className="flex items-center gap-2 mb-3 px-1">
          <button className="size-8 grid place-items-center rounded-lg hover:bg-secondary" onClick={() => setDay(addDays(day, -7))} aria-label="Semaine précédente" data-testid="button-prev-week"><ChevronLeft className="size-4" /></button>
          <button className="size-8 grid place-items-center rounded-lg hover:bg-secondary" onClick={() => setDay(addDays(day, 7))} aria-label="Semaine suivante" data-testid="button-next-week"><ChevronRight className="size-4" /></button>
          <span className="font-display font-semibold capitalize">{new Date(`${start}T12:00:00Z`).toLocaleDateString(LOC, { timeZone: TZ, month: "long", year: "numeric" })}</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setDay(todayKey())} data-testid="button-today">Aujourd'hui</Button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((k) => {
            const n = (byDay.get(k) ?? []).filter((v) => v.status !== "cancelled").length;
            const d = new Date(`${k}T12:00:00Z`);
            return (
              <button key={k} onClick={() => setDay(k)} data-testid={`button-day-${k}`}
                className={cn("rounded-xl py-2.5 flex flex-col items-center transition-all", k === day ? "bg-ink text-primary-foreground shadow-md" : "hover:bg-secondary", k === todayKey() && k !== day && "ring-1 ring-saffron")}>
                <span className="text-[10px] uppercase tracking-wider opacity-70">{d.toLocaleDateString(LOC, { timeZone: TZ, weekday: "short" })}</span>
                <span className="num text-lg font-semibold">{d.getUTCDate()}</span>
                <span className="flex gap-0.5 h-1.5 mt-0.5">{Array.from({ length: Math.min(n, 5) }).map((_, i) => <span key={i} className="size-1 rounded-full bg-saffron" />)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="panel rise">
        <div className="px-5 py-4 border-b font-display font-semibold capitalize">{fDateLong(`${day}T12:00:00Z`)}</div>
        {list.length === 0 ? (
          <Empty icon={<CalendarDays className="size-5" />} title="Journée libre" text="Aucun rendez-vous programmé pour ce jour."
            action={<Button variant="outline" onClick={() => setDlg({ open: true, visit: null })}><Plus className="size-4 mr-1.5" /> Programmer</Button>} />
        ) : (
          <ul className="divide-y">
            {list.map((v) => (
              <li key={v.id} className="px-5 py-3.5 flex flex-wrap items-center gap-4 row-hover" data-testid={`row-appointment-${v.id}`}>
                <span className="num text-lg font-semibold w-14">{fTime(v.scheduledAt)}</span>
                <div className="flex-1 min-w-40">
                  <Link href={`/patients/${v.patientId}`} className="font-medium text-sm hover:underline">{fullName(pOf(v.patientId))}</Link>
                  <div className="text-xs text-muted-foreground">{v.service} · {v.practitioner}{v.reason && ` · ${v.reason}`}</div>
                </div>
                <VisitBadge status={v.status} />
                <div className="flex gap-1">
                  {v.status === "scheduled" && <Button size="sm" disabled={busy === v.id} onClick={() => setStatus(v, "waiting")} data-testid={`button-arrive-${v.id}`}>Arrivé</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setDlg({ open: true, visit: v })} aria-label="Modifier" data-testid={`button-edit-appt-${v.id}`}><Pencil className="size-3.5" /></Button>
                  {v.status === "scheduled" && <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === v.id} onClick={() => setStatus(v, "cancelled")} aria-label="Annuler" data-testid={`button-cancel-${v.id}`}><X className="size-3.5" /></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VisitDialog open={dlg.open} onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))} ws={ws} visit={dlg.visit}
        defaults={{ status: "scheduled", scheduledAt: defaultAt }} title={dlg.visit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} />
    </div>
  );
}
