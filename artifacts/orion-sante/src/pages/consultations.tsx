import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Play, Check, Pencil, Printer, Receipt, Search, Stethoscope, Loader2 } from "lucide-react";
import { useUpdateVisit, type Visit, type VisitInputStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefresh, useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, PageHeader, PageSkeleton, Tabs, VisitBadge } from "@/components/kit";
import { InvoiceDialog, VisitDialog } from "@/components/dialogs";
import { PrescriptionDoc, usePrint } from "@/components/print";
import { VISIT_STATUS, dayKey, errMsg, fDateTime, fTime, fullName, todayKey, visitToInput } from "@/lib/fmt";

export function useVisitStatus() {
  const update = useUpdateVisit();
  const refresh = useRefresh();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function setStatus(v: Visit, status: VisitInputStatus) {
    setBusy(v.id);
    try {
      await update.mutateAsync({ id: v.id, data: { ...visitToInput(v), status } });
      await refresh();
      toast({ title: VISIT_STATUS[status] });
    } catch (e) {
      toast({ title: "Échec de la mise à jour", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }
  return { setStatus, busy };
}

export default function Consultations() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const { print } = usePrint();
  const { setStatus, busy } = useVisitStatus();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState("all");
  const [dlg, setDlg] = useState<{ open: boolean; visit: Visit | null }>({ open: false, visit: null });
  const [bill, setBill] = useState<Visit | null>(null);

  const today = useMemo(() => (ws ? ws.visits.filter((v) => dayKey(v.scheduledAt) === todayKey()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) : []), [ws]);
  const history = useMemo(() => {
    if (!ws) return [];
    const s = q.trim().toLowerCase();
    return ws.visits
      .filter((v) => status === "all" || v.status === status)
      .filter((v) => {
        if (!s) return true;
        const p = ws.patients.find((x) => x.id === v.patientId);
        return `${fullName(p)} ${p?.number} ${v.service} ${v.practitioner} ${v.reason}`.toLowerCase().includes(s);
      })
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }, [ws, q, status]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;

  const pOf = (id: string) => ws.patients.find((p) => p.id === id);
  const billed = new Set(ws.invoices.map((i) => i.visitId).filter(Boolean));
  const cols: { key: VisitInputStatus; title: string }[] = [
    { key: "waiting", title: "En attente" },
    { key: "in_progress", title: "En consultation" },
    { key: "completed", title: "Terminées" },
  ];

  const actions = (v: Visit) => (
    <div className="flex flex-wrap gap-1 mt-3">
      {v.status === "scheduled" && <Button size="sm" variant="outline" disabled={busy === v.id} onClick={() => setStatus(v, "waiting")} data-testid={`button-arrive-${v.id}`}>Arrivé</Button>}
      {v.status === "waiting" && <Button size="sm" disabled={busy === v.id} onClick={() => setStatus(v, "in_progress")} data-testid={`button-start-${v.id}`}>{busy === v.id ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Play className="size-3.5 mr-1" />} Appeler</Button>}
      {v.status === "in_progress" && <Button size="sm" disabled={busy === v.id} onClick={() => setStatus(v, "completed")} data-testid={`button-complete-${v.id}`}>{busy === v.id ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Check className="size-3.5 mr-1" />} Terminer</Button>}
      <Button size="sm" variant="ghost" onClick={() => setDlg({ open: true, visit: v })} data-testid={`button-edit-visit-${v.id}`}><Pencil className="size-3.5 mr-1" /> Dossier</Button>
      {v.prescription && <Button size="sm" variant="ghost" onClick={() => print(<PrescriptionDoc visit={v} patient={pOf(v.patientId)} settings={ws.settings} />)} data-testid={`button-print-rx-${v.id}`}><Printer className="size-3.5" /></Button>}
      {v.status !== "cancelled" && !billed.has(v.id) && <Button size="sm" variant="ghost" onClick={() => setBill(v)} data-testid={`button-bill-${v.id}`}><Receipt className="size-3.5 mr-1" /> Facturer</Button>}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Soins" title="Consultations" sub="File d'attente du jour, constantes, notes cliniques et ordonnances."
        actions={<Button onClick={() => setDlg({ open: true, visit: null })} data-testid="button-new-visit"><Plus className="size-4 mr-1.5" /> Enregistrer une arrivée</Button>} />

      <div className="mb-4 rise"><Tabs value={tab} onChange={setTab} items={[{ value: "queue", label: "File du jour", count: today.filter((v) => v.status === "waiting" || v.status === "in_progress").length }, { value: "history", label: "Historique", count: ws.visits.length }]} /></div>

      {tab === "queue" ? (
        <div className="grid md:grid-cols-3 gap-3">
          {cols.map((c) => {
            const list = today.filter((v) => v.status === c.key);
            return (
              <section key={c.key} className="rounded-2xl bg-secondary/60 p-2.5 min-h-48 rise">
                <div className="flex justify-between items-center px-2 py-1.5 mb-1">
                  <span className="font-display font-semibold text-sm">{c.title}</span>
                  <span className="num text-xs rounded-full bg-card px-2 py-0.5">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && <p className="text-xs text-muted-foreground px-2 py-6 text-center">Vide</p>}
                  {list.map((v) => {
                    const p = pOf(v.patientId);
                    return (
                      <article key={v.id} className="panel p-3.5" data-testid={`card-visit-${v.id}`}>
                        <div className="flex justify-between gap-2">
                          <Link href={`/patients/${v.patientId}`} className="font-medium text-sm hover:underline">{fullName(p)}</Link>
                          <span className="num text-xs text-muted-foreground">{fTime(v.scheduledAt)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{v.service} · {v.practitioner}</div>
                        {p?.allergies && <div className="text-[11px] text-destructive mt-1">Allergies : {p.allergies}</div>}
                        {v.reason && <p className="text-xs mt-1.5">{v.reason}</p>}
                        {actions(v)}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {today.filter((v) => v.status === "scheduled").length > 0 && (
            <section className="md:col-span-3 panel p-4 rise">
              <div className="font-display font-semibold text-sm mb-2">Rendez-vous attendus aujourd'hui</div>
              <div className="flex flex-wrap gap-2">
                {today.filter((v) => v.status === "scheduled").map((v) => (
                  <div key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                    <span className="num text-xs">{fTime(v.scheduledAt)}</span> {fullName(pOf(v.patientId))}
                    <Button size="sm" variant="outline" className="h-7" disabled={busy === v.id} onClick={() => setStatus(v, "waiting")} data-testid={`button-arrive-${v.id}`}>Arrivé</Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-56 max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="search" className="field pl-9" placeholder="Patient, prestation, praticien…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search-visits" />
            </div>
            <select className="field w-48" value={status} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-filter-status">
              <option value="all">Tous les statuts</option>
              {Object.entries(VISIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="panel overflow-hidden">
            {history.length === 0 ? <Empty icon={<Stethoscope className="size-5" />} title="Aucune consultation" text="Enregistrez une arrivée pour démarrer la file." /> : (
              <ul className="divide-y">
                {history.map((v) => (
                  <li key={v.id} className="px-5 py-3.5 row-hover" data-testid={`row-visit-${v.id}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <Link href={`/patients/${v.patientId}`} className="font-medium text-sm hover:underline">{fullName(pOf(v.patientId))}</Link>
                        <div className="text-xs text-muted-foreground">{fDateTime(v.scheduledAt)} · {v.service} · {v.practitioner}</div>
                      </div>
                      <VisitBadge status={v.status} />
                    </div>
                    {actions(v)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <VisitDialog open={dlg.open} onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))} ws={ws} visit={dlg.visit} />
      <InvoiceDialog open={!!bill} onOpenChange={(o) => !o && setBill(null)} ws={ws} patientId={bill?.patientId} visitId={bill?.id} />
    </div>
  );
}
