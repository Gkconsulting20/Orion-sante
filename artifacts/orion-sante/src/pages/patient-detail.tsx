import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Pencil, Plus, AlertTriangle, Stethoscope, Receipt, Printer, Wallet, FileText, Download, Trash2, ShieldCheck } from "lucide-react";
import { useDeletePatient, useExportPatient, type Invoice, type Payment, type Visit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRefresh, useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, InvoiceBadge, PageSkeleton, VisitBadge } from "@/components/kit";
import { InvoiceDialog, PatientDialog, PaymentDialog, ReceiptDialog, VisitDialog } from "@/components/dialogs";
import { InvoiceDoc, PrescriptionDoc, usePrint } from "@/components/print";
import { METHOD, age, fDate, fDateTime, fcfa, fullName, initials, remaining } from "@/lib/fmt";
import { can, canSeeClinical, maskPhone, roleOf } from "@/lib/roles";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const { print } = usePrint();
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const refresh = useRefresh();
  const [edit, setEdit] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<Visit | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [invVisit, setInvVisit] = useState<string | undefined>();
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deletePatient = useDeletePatient();
  const exportQuery = useExportPatient(id ?? "", { query: { enabled: false, retry: false } });

  const role = roleOf(ws);
  const canSeeMedical = canSeeClinical(role);
  const canExport = role === "owner" || role === "doctor";
  const canDelete = role === "owner";

  async function exportData() {
    try {
      const result = await exportQuery.refetch();
      if (!result.data) throw new Error("Export impossible.");
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${result.data.patient.number}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await refresh();
      toast({ title: "Dossier exporté", description: "L'export a été journalisé." });
    } catch (e) {
      toast({ title: "Export impossible", description: e instanceof Error ? e.message : "Une erreur est survenue." });
    }
  }

  async function confirmDelete() {
    if (!id) return;
    try {
      await deletePatient.mutateAsync({ id });
      await refresh();
      toast({ title: "Dossier supprimé", description: "Les factures et paiements sont conservés, anonymisés." });
      setLoc("/patients");
    } catch (e) {
      toast({ title: "Suppression impossible", description: e instanceof Error ? e.message : "Une erreur est survenue." });
    }
  }

  const data = useMemo(() => {
    if (!ws) return null;
    const p = ws.patients.find((x) => x.id === id);
    if (!p) return null;
    return {
      p,
      visits: ws.visits.filter((v) => v.patientId === id).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
      invoices: ws.invoices.filter((i) => i.patientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      payments: ws.payments.filter((x) => x.patientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }, [ws, id]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return (
    <div className="panel"><Empty icon={<FileText className="size-5" />} title="Dossier introuvable" text="Ce patient n'existe pas dans cette clinique." action={<Link href="/patients" className="text-sm underline">Retour au registre</Link>} /></div>
  );
  const { p, visits, invoices, payments } = data;
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);
  const invByVisit = new Map(invoices.filter((i) => i.visitId).map((i) => [i.visitId as string, i]));

  return (
    <div>
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="link-back-patients"><ArrowLeft className="size-4" /> Registre des patients</Link>

      <div className="panel p-5 md:p-6 mb-3 rise">
        <div className="flex flex-col md:flex-row gap-5 md:items-center">
          <div className="size-14 rounded-2xl bg-ink text-primary-foreground grid place-items-center font-display text-lg font-semibold">{initials(p)}</div>
          <div className="flex-1 min-w-0">
            <div className="num text-xs text-muted-foreground">{p.number}</div>
            <h1 className="text-2xl font-semibold" data-testid="text-patient-name">{fullName(p)}</h1>
            <div className="text-sm text-muted-foreground mt-0.5">
              {p.sex === "F" ? "Femme" : "Homme"} · {age(p.birthDate) ?? "—"} ans (né·e le {fDate(p.birthDate)}) · {role === "accountant" ? maskPhone(p.phone) : (p.phone || "sans téléphone")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(ws, "patients", "write") && <Button variant="outline" onClick={() => setEdit(true)} data-testid="button-edit-patient"><Pencil className="size-4 mr-1.5" /> Modifier</Button>}
            {can(ws, "consultations", "write") && <Button variant="outline" onClick={() => { setEditVisit(null); setVisitOpen(true); }} data-testid="button-new-visit"><Stethoscope className="size-4 mr-1.5" /> Consultation</Button>}
            {can(ws, "facturation", "write") && <Button onClick={() => { setInvVisit(undefined); setInvOpen(true); }} data-testid="button-new-invoice"><Plus className="size-4 mr-1.5" /> Facture</Button>}
            {canExport && <Button variant="outline" onClick={exportData} disabled={exportQuery.isFetching} data-testid="button-export-patient"><Download className="size-4 mr-1.5" /> Exporter mes données</Button>}
            {canDelete && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} data-testid="button-delete-patient"><Trash2 className="size-4 mr-1.5" /> Supprimer le dossier</Button>}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-5 pt-5 border-t text-sm">
          <div><div className="label-s mb-1">Adresse</div>{p.address || "—"}</div>
          <div><div className="label-s mb-1">Contact d'urgence</div>{p.emergencyContact || "—"}</div>
          <div className="grid grid-cols-3 gap-2">
            <div><div className="label-s mb-1">Facturé</div><span className="num">{fcfa(billed)}</span></div>
            <div><div className="label-s mb-1">Payé</div><span className="num text-lagoon">{fcfa(paid)}</span></div>
            <div><div className="label-s mb-1">Dû</div><span className={`num ${billed - paid > 0 ? "text-destructive font-semibold" : ""}`}>{fcfa(billed - paid)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t text-sm">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Consentement au traitement des données : </span>
          {p.consentGiven ? (
            <span>donné le {fDate(p.consentDate)} ({p.consentMethod === "écrit" ? "écrit" : "oral"})</span>
          ) : (
            <span className="text-destructive font-medium">non renseigné</span>
          )}
        </div>
      </div>

      <div className={`rounded-xl px-4 py-3 mb-3 flex gap-3 items-start rise ${canSeeMedical && p.allergies ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`} data-testid="text-allergies">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        <div className="text-sm"><span className="font-semibold">Allergies : </span>{canSeeMedical ? (p.allergies || "aucune allergie connue") : "Réservé au médecin"}</div>
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-3">
        <section className="panel rise">
          <div className="px-5 py-4 border-b flex justify-between items-center"><h3 className="font-semibold">Consultations</h3><span className="num text-xs text-muted-foreground">{visits.length}</span></div>
          {visits.length === 0 ? <Empty icon={<Stethoscope className="size-5" />} title="Aucune consultation" /> : (
            <ul className="divide-y">
              {visits.map((v) => {
                const inv = invByVisit.get(v.id);
                return (
                  <li key={v.id} className="px-5 py-4" data-testid={`row-visit-${v.id}`}>
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{v.service} <span className="text-muted-foreground font-normal">· {v.practitioner}</span></div>
                        <div className="text-xs text-muted-foreground">{fDateTime(v.scheduledAt)}</div>
                      </div>
                      <VisitBadge status={v.status} />
                    </div>
                    {v.reason && <p className="text-sm mt-2">{v.reason}</p>}
                    {canSeeMedical ? (
                      <>
                        {(v.temperature || v.bloodPressure || v.weight) && (
                          <div className="flex gap-4 mt-2 text-xs num text-muted-foreground">
                            {v.temperature && <span>T° {v.temperature}</span>}{v.bloodPressure && <span>TA {v.bloodPressure}</span>}{v.weight && <span>{v.weight} kg</span>}
                          </div>
                        )}
                        {v.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap border-l-2 border-saffron pl-2.5">{v.notes}</p>}
                      </>
                    ) : (
                      (v.notes || v.temperature || v.bloodPressure || v.weight || v.prescription) && (
                        <p className="text-xs text-muted-foreground mt-2">Détails médicaux — réservé au médecin.</p>
                      )
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {can(ws, "consultations", "write") && <Button size="sm" variant="ghost" onClick={() => { setEditVisit(v); setVisitOpen(true); }} data-testid={`button-edit-visit-${v.id}`}><Pencil className="size-3.5 mr-1" /> Modifier</Button>}
                      {canSeeMedical && v.prescription && <Button size="sm" variant="ghost" onClick={() => print(<PrescriptionDoc visit={v} patient={p} settings={ws.settings} />)} data-testid={`button-print-rx-${v.id}`}><Printer className="size-3.5 mr-1" /> Ordonnance</Button>}
                      {inv ? <span className="text-xs inline-flex items-center gap-1.5 px-2 text-muted-foreground"><Receipt className="size-3.5" /> {inv.number} <InvoiceBadge status={inv.status} /></span>
                        : v.status !== "cancelled" && can(ws, "facturation", "write") && <Button size="sm" variant="ghost" onClick={() => { setInvVisit(v.id); setInvOpen(true); }} data-testid={`button-bill-visit-${v.id}`}><Receipt className="size-3.5 mr-1" /> Facturer</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-3">
          <section className="panel rise">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold">Factures</h3></div>
            {invoices.length === 0 ? <Empty icon={<Receipt className="size-5" />} title="Aucune facture" /> : (
              <ul className="divide-y">
                {invoices.map((i) => (
                  <li key={i.id} className="px-5 py-3 flex items-center gap-3" data-testid={`row-invoice-${i.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm"><span className="num">{i.number}</span> · {i.service}</div>
                      <div className="text-xs text-muted-foreground">{fDate(i.createdAt)} · <span className="num">{fcfa(i.total)}</span>{i.status !== "paid" && <> · reste <span className="num text-destructive">{fcfa(remaining(i))}</span></>}</div>
                    </div>
                    <InvoiceBadge status={i.status} />
                    <button className="size-8 grid place-items-center rounded-md hover:bg-secondary" onClick={() => print(<InvoiceDoc invoice={i} patient={p} settings={ws.settings} />)} aria-label="Imprimer la facture" data-testid={`button-print-invoice-${i.id}`}><Printer className="size-4" /></button>
                    {i.status !== "paid" && can(ws, "facturation", "write") && <Button size="sm" onClick={() => setPayInv(i)} data-testid={`button-pay-${i.id}`}><Wallet className="size-3.5 mr-1" /> Encaisser</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel rise">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold">Reçus</h3></div>
            {payments.length === 0 ? <p className="text-sm text-muted-foreground px-5 py-6">Aucun paiement reçu.</p> : (
              <ul className="divide-y">
                {payments.map((x) => (
                  <li key={x.id} className="px-5 py-3 flex items-center gap-3 row-hover cursor-pointer" onClick={() => setReceipt(x)} data-testid={`row-receipt-${x.id}`}>
                    <div className="flex-1"><div className="text-sm num">{x.receiptNumber}</div><div className="text-xs text-muted-foreground">{fDateTime(x.createdAt)} · {METHOD[x.method]}</div></div>
                    <span className="num text-sm text-lagoon">{fcfa(x.amount)}</span>
                    <Printer className="size-4 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <PatientDialog open={edit} onOpenChange={setEdit} patient={p} />
      <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} ws={ws} visit={editVisit} defaults={{ patientId: p.id }} />
      <InvoiceDialog open={invOpen} onOpenChange={setInvOpen} ws={ws} patientId={p.id} visitId={invVisit} onCreated={(inv) => setPayInv(inv)} />
      <PaymentDialog open={!!payInv} onOpenChange={(o) => !o && setPayInv(null)} ws={ws} invoice={payInv} onPaid={setReceipt} />
      <ReceiptDialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} ws={ws} payment={receipt} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le dossier {p.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le patient, ses consultations et ses rendez-vous seront définitivement supprimés.
              Les factures et paiements sont conservés pour la comptabilité, mais anonymisés
              (nom remplacé par « Patient supprimé », téléphone et adresse effacés).
              Cette action est journalisée. Êtes-vous certain ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deletePatient.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-patient">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
