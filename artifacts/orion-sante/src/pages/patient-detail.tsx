import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Pencil, Plus, AlertTriangle, Stethoscope, Receipt, Printer, Wallet, FileText } from "lucide-react";
import type { Invoice, Payment, Visit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, InvoiceBadge, PageSkeleton, VisitBadge } from "@/components/kit";
import { InvoiceDialog, PatientDialog, PaymentDialog, ReceiptDialog, VisitDialog } from "@/components/dialogs";
import { InvoiceDoc, PrescriptionDoc, usePrint } from "@/components/print";
import { METHOD, age, fDate, fDateTime, fcfa, fullName, initials, remaining } from "@/lib/fmt";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const { print } = usePrint();
  const [edit, setEdit] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<Visit | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [invVisit, setInvVisit] = useState<string | undefined>();
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

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
              {p.sex === "F" ? "Femme" : "Homme"} · {age(p.birthDate) ?? "—"} ans (né·e le {fDate(p.birthDate)}) · {p.phone || "sans téléphone"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEdit(true)} data-testid="button-edit-patient"><Pencil className="size-4 mr-1.5" /> Modifier</Button>
            <Button variant="outline" onClick={() => { setEditVisit(null); setVisitOpen(true); }} data-testid="button-new-visit"><Stethoscope className="size-4 mr-1.5" /> Consultation</Button>
            <Button onClick={() => { setInvVisit(undefined); setInvOpen(true); }} data-testid="button-new-invoice"><Plus className="size-4 mr-1.5" /> Facture</Button>
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
      </div>

      <div className={`rounded-xl px-4 py-3 mb-3 flex gap-3 items-start rise ${p.allergies ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`} data-testid="text-allergies">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        <div className="text-sm"><span className="font-semibold">Allergies : </span>{p.allergies || "aucune allergie connue"}</div>
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
                    {(v.temperature || v.bloodPressure || v.weight) && (
                      <div className="flex gap-4 mt-2 text-xs num text-muted-foreground">
                        {v.temperature && <span>T° {v.temperature}</span>}{v.bloodPressure && <span>TA {v.bloodPressure}</span>}{v.weight && <span>{v.weight} kg</span>}
                      </div>
                    )}
                    {v.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap border-l-2 border-saffron pl-2.5">{v.notes}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Button size="sm" variant="ghost" onClick={() => { setEditVisit(v); setVisitOpen(true); }} data-testid={`button-edit-visit-${v.id}`}><Pencil className="size-3.5 mr-1" /> Modifier</Button>
                      {v.prescription && <Button size="sm" variant="ghost" onClick={() => print(<PrescriptionDoc visit={v} patient={p} settings={ws.settings} />)} data-testid={`button-print-rx-${v.id}`}><Printer className="size-3.5 mr-1" /> Ordonnance</Button>}
                      {inv ? <span className="text-xs inline-flex items-center gap-1.5 px-2 text-muted-foreground"><Receipt className="size-3.5" /> {inv.number} <InvoiceBadge status={inv.status} /></span>
                        : v.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => { setInvVisit(v.id); setInvOpen(true); }} data-testid={`button-bill-visit-${v.id}`}><Receipt className="size-3.5 mr-1" /> Facturer</Button>}
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
                    {i.status !== "paid" && <Button size="sm" onClick={() => setPayInv(i)} data-testid={`button-pay-${i.id}`}><Wallet className="size-3.5 mr-1" /> Encaisser</Button>}
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
    </div>
  );
}
