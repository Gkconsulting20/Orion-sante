import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, Users, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, PageHeader, PageSkeleton } from "@/components/kit";
import { PatientDialog } from "@/components/dialogs";
import { age, fDate, fcfa, fullName, initials, remaining } from "@/lib/fmt";

export default function Patients() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLoc] = useLocation();

  const rows = useMemo(() => {
    if (!ws) return [];
    const s = q.trim().toLowerCase();
    const due = new Map<string, number>();
    ws.invoices.forEach((i) => due.set(i.patientId, (due.get(i.patientId) ?? 0) + remaining(i)));
    const last = new Map<string, string>();
    ws.visits.forEach((v) => { if ((last.get(v.patientId) ?? "") < v.scheduledAt) last.set(v.patientId, v.scheduledAt); });
    return ws.patients
      .filter((p) => !s || `${p.firstName} ${p.lastName} ${p.number} ${p.phone}`.toLowerCase().includes(s))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ p, due: due.get(p.id) ?? 0, last: last.get(p.id) }));
  }, [ws, q]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader eyebrow="Registre" title="Patients" sub={`${ws.patients.length} dossier(s). Recherchez par nom, numéro de dossier ou téléphone.`}
        actions={<Button onClick={() => setOpen(true)} data-testid="button-new-patient"><Plus className="size-4 mr-1.5" /> Nouveau patient</Button>} />

      <div className="relative mb-4 max-w-md rise">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" className="field pl-9 h-11" placeholder="Rechercher un patient…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search-patients" />
      </div>

      <div className="panel overflow-hidden rise">
        {rows.length === 0 ? (
          <Empty icon={<Users className="size-5" />} title={q ? "Aucun résultat" : "Aucun patient enregistré"} text={q ? "Vérifiez l'orthographe ou le numéro de dossier." : "Créez le premier dossier pour commencer à suivre soins et factures."}
            action={!q && <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1.5" /> Nouveau patient</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Patient</th>
                  <th className="label-s px-4 py-2.5">Dossier</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Âge</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Téléphone</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Dernière visite</th>
                  <th className="label-s px-4 py-2.5 text-right">Solde dû</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, due, last }) => (
                  <tr key={p.id} className="border-b last:border-0 row-hover cursor-pointer" onClick={() => setLoc(`/patients/${p.id}`)} data-testid={`row-patient-${p.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-semibold">{initials(p)}</div>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">{fullName(p)} {p.allergies && <AlertTriangle className="size-3.5 text-destructive" aria-label="Allergies" />}</div>
                          <div className="text-xs text-muted-foreground">{p.sex === "F" ? "Femme" : "Homme"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 num text-xs">{p.number}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{age(p.birthDate) ?? "—"} ans</td>
                    <td className="px-4 py-3 hidden md:table-cell num text-xs">{p.phone || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{last ? fDate(last) : "—"}</td>
                    <td className={`px-4 py-3 text-right num ${due > 0 ? "text-destructive" : "text-muted-foreground"}`}>{due > 0 ? fcfa(due) : "—"}</td>
                    <td className="pr-3"><Link href={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()} className="size-7 grid place-items-center rounded-md hover:bg-secondary" aria-label="Ouvrir"><ChevronRight className="size-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PatientDialog open={open} onOpenChange={setOpen} onSaved={(p) => setLoc(`/patients/${p.id}`)} />
    </div>
  );
}
