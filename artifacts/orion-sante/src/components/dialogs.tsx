import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, Printer, AlertTriangle, Loader2 } from "lucide-react";
import {
  useCreatePatient,
  useUpdatePatient,
  useCreateVisit,
  useUpdateVisit,
  useCreateInvoice,
  useCreatePayment,
  useCreateExpense,
  useSetCashSession,
  type Patient,
  type PatientInput,
  type Visit,
  type VisitInput,
  type Invoice,
  type InvoiceLine,
  type Payment,
  type PaymentInputMethod,
  type ExpenseInput,
  type ExpenseInputCategory,
  type Workspace,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefresh } from "@/hooks/use-clinic";
import { Field } from "@/components/kit";
import { ReceiptDoc, usePrint } from "@/components/print";
import {
  CATEGORY,
  METHOD,
  VISIT_STATUS,
  errMsg,
  fDateTime,
  fcfa,
  fromLocalInput,
  fullName,
  intOnly,
  nowLocalInput,
  paymentBalances,
  remaining,
  toLocalInput,
} from "@/lib/fmt";

type Base = { open: boolean; onOpenChange: (o: boolean) => void };

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2 flex gap-2 items-start" data-testid="text-form-error">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" /> {msg}
    </div>
  );
}

function Submit({ pending, label, disabled }: { pending: boolean; label: string; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={pending || disabled} data-testid="button-submit">
      {pending && <Loader2 className="size-4 mr-2 animate-spin" />} {label}
    </Button>
  );
}

/* ---------------- Patient ---------------- */
const emptyPatient: PatientInput = { firstName: "", lastName: "", sex: "F", birthDate: "", phone: "", address: "", emergencyContact: "", allergies: "" };

export function PatientDialog({ open, onOpenChange, patient, onSaved }: Base & { patient?: Patient | null; onSaved?: (p: Patient) => void }) {
  const [f, setF] = useState<PatientInput>(emptyPatient);
  const [error, setError] = useState("");
  const create = useCreatePatient();
  const update = useUpdatePatient();
  const refresh = useRefresh();
  const { toast } = useToast();
  useEffect(() => {
    if (open) {
      setError("");
      setF(patient ? { firstName: patient.firstName, lastName: patient.lastName, sex: patient.sex, birthDate: patient.birthDate.slice(0, 10), phone: patient.phone, address: patient.address, emergencyContact: patient.emergencyContact, allergies: patient.allergies } : emptyPatient);
    }
  }, [open, patient]);
  const set = (k: keyof PatientInput, v: string) => setF((s) => ({ ...s, [k]: v }));
  const pending = create.isPending || update.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.firstName.trim() || !f.lastName.trim()) return setError("Nom et prénom sont obligatoires.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birthDate) || isNaN(new Date(f.birthDate).getTime()) || new Date(f.birthDate) > new Date()) return setError("Date de naissance invalide.");
    const data = { ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim() };
    try {
      const saved = patient ? await update.mutateAsync({ id: patient.id, data }) : await create.mutateAsync({ data });
      await refresh();
      toast({ title: patient ? "Dossier mis à jour" : "Patient enregistré", description: `${fullName(saved)} · ${saved.number}` });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{patient ? "Modifier le dossier" : "Nouveau patient"}</DialogTitle>
          <DialogDescription>{patient ? `Dossier ${patient.number}` : "Le numéro de dossier est attribué automatiquement."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><input className="field" value={f.lastName} maxLength={100} onChange={(e) => set("lastName", e.target.value)} data-testid="input-lastname" /></Field>
            <Field label="Prénom(s)"><input className="field" value={f.firstName} maxLength={100} onChange={(e) => set("firstName", e.target.value)} data-testid="input-firstname" /></Field>
            <Field label="Sexe">
              <select className="field" value={f.sex} onChange={(e) => set("sex", e.target.value)} data-testid="select-sex">
                <option value="F">Femme</option>
                <option value="M">Homme</option>
              </select>
            </Field>
            <Field label="Date de naissance"><input type="date" className="field" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} data-testid="input-birthdate" /></Field>
            <Field label="Téléphone"><input className="field" value={f.phone} maxLength={30} placeholder="+228 90 00 00 00" onChange={(e) => set("phone", e.target.value)} data-testid="input-phone" /></Field>
            <Field label="Contact d'urgence"><input className="field" value={f.emergencyContact} maxLength={300} onChange={(e) => set("emergencyContact", e.target.value)} data-testid="input-emergency" /></Field>
          </div>
          <Field label="Adresse"><input className="field" value={f.address} maxLength={300} placeholder="Quartier, ville" onChange={(e) => set("address", e.target.value)} data-testid="input-address" /></Field>
          <Field label="Allergies connues" hint="Laisser vide si aucune allergie connue.">
            <textarea className="field" value={f.allergies} maxLength={2000} onChange={(e) => set("allergies", e.target.value)} data-testid="input-allergies" />
          </Field>
          <Err msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Submit pending={pending} label={patient ? "Enregistrer" : "Créer le dossier"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Visit ---------------- */
export function VisitDialog({ open, onOpenChange, ws, visit, defaults, title }: Base & { ws: Workspace; visit?: Visit | null; defaults?: Partial<VisitInput>; title?: string }) {
  const blank = (): VisitInput => ({
    patientId: "",
    service: ws.settings.services[0]?.name ?? "",
    practitioner: ws.settings.practitioners[0] ?? "",
    scheduledAt: new Date().toISOString(),
    status: "waiting",
    reason: "",
    notes: "",
    prescription: "",
    temperature: "",
    bloodPressure: "",
    weight: "",
    ...defaults,
  });
  const [f, setF] = useState<VisitInput>(blank);
  const [when, setWhen] = useState("");
  const [error, setError] = useState("");
  const create = useCreateVisit();
  const update = useUpdateVisit();
  const refresh = useRefresh();
  const { toast } = useToast();
  useEffect(() => {
    if (!open) return;
    setError("");
    const init = visit ? { ...visit } : blank();
    setF(init);
    setWhen(visit ? toLocalInput(visit.scheduledAt) : defaults?.scheduledAt ? toLocalInput(defaults.scheduledAt) : nowLocalInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit]);
  const set = (k: keyof VisitInput, v: string) => setF((s) => ({ ...s, [k]: v }));
  const patients = useMemo(() => [...ws.patients].sort((a, b) => a.lastName.localeCompare(b.lastName)), [ws.patients]);
  const pending = create.isPending || update.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const iso = fromLocalInput(when);
    if (!f.patientId) return setError("Choisissez un patient.");
    if (!f.service.trim() || !f.practitioner.trim()) return setError("Prestation et praticien sont obligatoires.");
    if (!iso) return setError("Date et heure invalides.");
    const data: VisitInput = {
      patientId: f.patientId, service: f.service.trim(), practitioner: f.practitioner.trim(), scheduledAt: iso, status: f.status,
      reason: f.reason, notes: f.notes, prescription: f.prescription, temperature: f.temperature, bloodPressure: f.bloodPressure, weight: f.weight,
    };
    try {
      if (visit) await update.mutateAsync({ id: visit.id, data });
      else await create.mutateAsync({ data });
      await refresh();
      toast({ title: visit ? "Consultation mise à jour" : "Consultation enregistrée", description: VISIT_STATUS[data.status] });
      onOpenChange(false);
    } catch (err) {
      setError(errMsg(err));
    }
  }
  const patient = ws.patients.find((p) => p.id === f.patientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title ?? (visit ? "Modifier la consultation" : "Nouvelle consultation")}</DialogTitle>
          <DialogDescription>Motif, constantes, notes cliniques et ordonnance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Patient" className="sm:col-span-2">
              <select className="field" value={f.patientId} onChange={(e) => set("patientId", e.target.value)} disabled={!!visit} data-testid="select-patient">
                <option value="">Sélectionner un patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{fullName(p)} — {p.number}</option>)}
              </select>
            </Field>
            {patient?.allergies && (
              <div className="sm:col-span-2 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2 flex gap-2"><AlertTriangle className="size-4 mt-0.5" /> Allergies : {patient.allergies}</div>
            )}
            <Field label="Prestation">
              <input className="field" list="svc-list" value={f.service} maxLength={100} onChange={(e) => set("service", e.target.value)} data-testid="input-service" />
              <datalist id="svc-list">{ws.settings.services.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            </Field>
            <Field label="Praticien">
              <input className="field" list="prac-list" value={f.practitioner} maxLength={100} onChange={(e) => set("practitioner", e.target.value)} data-testid="input-practitioner" />
              <datalist id="prac-list">{ws.settings.practitioners.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Date et heure (Lomé)"><input type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="input-scheduled" /></Field>
            <Field label="Statut">
              <select className="field" value={f.status} onChange={(e) => set("status", e.target.value)} data-testid="select-status">
                {Object.entries(VISIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Motif de consultation"><input className="field" value={f.reason} maxLength={1000} onChange={(e) => set("reason", e.target.value)} data-testid="input-reason" /></Field>
          <div>
            <div className="label-s mb-2">Constantes</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Température (°C)"><input className="field num" value={f.temperature} maxLength={20} placeholder="37,2" onChange={(e) => set("temperature", e.target.value)} data-testid="input-temperature" /></Field>
              <Field label="Tension (mmHg)"><input className="field num" value={f.bloodPressure} maxLength={30} placeholder="12/8" onChange={(e) => set("bloodPressure", e.target.value)} data-testid="input-bp" /></Field>
              <Field label="Poids (kg)"><input className="field num" value={f.weight} maxLength={20} placeholder="64" onChange={(e) => set("weight", e.target.value)} data-testid="input-weight" /></Field>
            </div>
          </div>
          <Field label="Notes cliniques"><textarea className="field" rows={4} value={f.notes} maxLength={10000} onChange={(e) => set("notes", e.target.value)} data-testid="input-notes" /></Field>
          <Field label="Ordonnance" hint="Une ligne par médicament : nom, dosage, posologie, durée."><textarea className="field num text-[13px]" rows={4} value={f.prescription} maxLength={5000} onChange={(e) => set("prescription", e.target.value)} data-testid="input-prescription" /></Field>
          <Err msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Submit pending={pending} label="Enregistrer" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Invoice ---------------- */
type LineDraft = { label: string; quantity: string; unitPrice: string };
export function InvoiceDialog({ open, onOpenChange, ws, patientId, visitId, onCreated }: Base & { ws: Workspace; patientId?: string; visitId?: string; onCreated?: (inv: Invoice) => void }) {
  const [pid, setPid] = useState("");
  const [vid, setVid] = useState("");
  const [service, setService] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState("");
  const create = useCreateInvoice();
  const refresh = useRefresh();
  const { toast } = useToast();
  const priceOf = (name: string) => ws.settings.services.find((s) => s.name === name)?.price;

  useEffect(() => {
    if (!open) return;
    setError("");
    setPid(patientId ?? "");
    setVid(visitId ?? "");
    const v = ws.visits.find((x) => x.id === visitId);
    const svc = v?.service ?? ws.settings.services[0]?.name ?? "";
    setService(svc);
    const p = priceOf(svc);
    setLines([{ label: svc, quantity: "1", unitPrice: p !== undefined ? String(p) : "" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, visitId]);

  const visits = useMemo(() => ws.visits.filter((v) => v.patientId === pid && v.status !== "cancelled").sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)), [ws.visits, pid]);
  const total = lines.reduce((s, l) => s + intOnly(l.quantity) * intOnly(l.unitPrice), 0);
  const setLine = (i: number, k: keyof LineDraft, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pid) return setError("Choisissez un patient.");
    if (!service.trim()) return setError("Indiquez la prestation principale.");
    const parsed: InvoiceLine[] = [];
    for (const l of lines) {
      const q = intOnly(l.quantity), u = intOnly(l.unitPrice);
      if (!l.label.trim()) return setError("Chaque ligne doit avoir une désignation.");
      if (q < 1 || q > 1000) return setError("Quantité entre 1 et 1000.");
      if (u < 0 || u > 100_000_000 || l.unitPrice.trim() === "") return setError("Prix unitaire invalide (FCFA entier).");
      parsed.push({ label: l.label.trim(), quantity: q, unitPrice: u });
    }
    if (!parsed.length) return setError("Ajoutez au moins une ligne.");
    try {
      const inv = await create.mutateAsync({ data: { patientId: pid, service: service.trim(), lines: parsed, ...(vid ? { visitId: vid } : {}) } });
      await refresh();
      toast({ title: "Facture créée", description: `${inv.number} · ${fcfa(inv.total)}` });
      onOpenChange(false);
      onCreated?.(inv);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle facture</DialogTitle>
          <DialogDescription>Liée au dossier du patient et, si besoin, à une consultation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Patient">
              <select className="field" value={pid} onChange={(e) => { setPid(e.target.value); setVid(""); }} data-testid="select-invoice-patient">
                <option value="">Sélectionner…</option>
                {[...ws.patients].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((p) => <option key={p.id} value={p.id}>{fullName(p)} — {p.number}</option>)}
              </select>
            </Field>
            <Field label="Consultation liée (optionnel)">
              <select className="field" value={vid} onChange={(e) => setVid(e.target.value)} disabled={!pid} data-testid="select-invoice-visit">
                <option value="">Aucune</option>
                {visits.map((v) => <option key={v.id} value={v.id}>{fDateTime(v.scheduledAt)} · {v.service}</option>)}
              </select>
            </Field>
            <Field label="Prestation principale" className="sm:col-span-2">
              <input className="field" list="svc-list-inv" value={service} onChange={(e) => setService(e.target.value)} data-testid="input-invoice-service" />
              <datalist id="svc-list-inv">{ws.settings.services.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            </Field>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-[1fr_64px_120px_110px_36px] gap-2 px-3 py-2 bg-secondary label-s">
              <span>Désignation</span><span className="text-right">Qté</span><span className="text-right">P.U. FCFA</span><span className="text-right">Montant</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_120px_110px_36px] gap-2 px-3 py-2 border-t items-center">
                <input className="field h-9" value={l.label} maxLength={200} onChange={(e) => setLine(i, "label", e.target.value)} data-testid={`input-line-label-${i}`} />
                <input className="field h-9 num text-right" inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value.replace(/[^\d]/g, ""))} data-testid={`input-line-qty-${i}`} />
                <input className="field h-9 num text-right" inputMode="numeric" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value.replace(/[^\d]/g, ""))} data-testid={`input-line-price-${i}`} />
                <span className="num text-sm text-right">{fcfa(intOnly(l.quantity) * intOnly(l.unitPrice)).replace(" FCFA", "")}</span>
                <button type="button" className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} data-testid={`button-remove-line-${i}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5 border-t bg-background/60">
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { label: "", quantity: "1", unitPrice: "" }])} data-testid="button-add-line"><Plus className="size-3.5 mr-1" /> Ligne libre</Button>
              {ws.settings.services.slice(0, 6).map((s) => (
                <button key={s.id} type="button" className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground hover:brightness-95 transition" onClick={() => setLines((ls) => [...ls, { label: s.name, quantity: "1", unitPrice: String(s.price) }])} data-testid={`button-add-service-${s.id}`}>
                  + {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-baseline rounded-xl bg-ink text-primary-foreground px-4 py-3">
            <span className="label-s !text-primary-foreground/70">Total estimé</span>
            <span className="num text-xl font-semibold" data-testid="text-invoice-total">{fcfa(total)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">Le total, le montant payé et le statut sont calculés par le serveur.</p>
          <Err msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Submit pending={create.isPending} label="Créer la facture" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Payment ---------------- */
export function PaymentDialog({ open, onOpenChange, ws, invoice, onPaid }: Base & { ws: Workspace; invoice: Invoice | null; onPaid?: (p: Payment) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentInputMethod>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef<string>("");
  const create = useCreatePayment();
  const refresh = useRefresh();
  const { toast } = useToast();
  const due = invoice ? remaining(invoice) : 0;

  useEffect(() => {
    if (open && invoice) {
      setAmount(String(remaining(invoice)));
      setMethod(ws.cashSession.isOpen ? "cash" : "tmoney");
      setReference("");
      setError("");
      requestId.current = crypto.randomUUID();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  const cashBlocked = method === "cash" && !ws.cashSession.isOpen;
  const patient = ws.patients.find((p) => p.id === invoice?.patientId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    const a = intOnly(amount);
    if (a < 1) return setError("Montant invalide.");
    if (a > due) return setError(`Le montant dépasse le reste à payer (${fcfa(due)}).`);
    if (cashBlocked) return setError("Ouvrez la caisse avant d'encaisser en espèces.");
    try {
      const p = await create.mutateAsync({ data: { invoiceId: invoice.id, amount: a, method, reference: reference.trim(), requestId: requestId.current } });
      requestId.current = crypto.randomUUID();
      await refresh();
      toast({ title: "Paiement enregistré", description: `${p.receiptNumber} · ${fcfa(p.amount)}` });
      onOpenChange(false);
      onPaid?.(p);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Encaisser un paiement</DialogTitle>
          <DialogDescription>{invoice ? `${invoice.number} · ${fullName(patient)}` : ""}</DialogDescription>
        </DialogHeader>
        {invoice && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 rounded-xl border divide-x text-center">
              <div className="p-2.5"><div className="label-s">Total</div><div className="num text-sm mt-1">{fcfa(invoice.total)}</div></div>
              <div className="p-2.5"><div className="label-s">Payé</div><div className="num text-sm mt-1 text-lagoon">{fcfa(invoice.paid)}</div></div>
              <div className="p-2.5 bg-accent/60"><div className="label-s">Reste</div><div className="num text-sm mt-1 font-semibold">{fcfa(due)}</div></div>
            </div>
            <Field label="Montant reçu (FCFA)">
              <div className="flex gap-2">
                <input className="field num text-lg h-11" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} data-testid="input-payment-amount" />
                <Button type="button" variant="outline" className="h-11" onClick={() => setAmount(String(due))} data-testid="button-pay-full">Solde</Button>
              </div>
            </Field>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Mode de paiement</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(METHOD) as PaymentInputMethod[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} data-testid={`button-method-${m}`}
                    className={`h-10 rounded-lg border text-sm transition-all ${method === m ? "border-ink bg-ink text-primary-foreground shadow-sm" : "hover:border-ink/40 bg-card"}`}>
                    {METHOD[m]}
                  </button>
                ))}
              </div>
            </div>
            {method !== "cash" && (
              <Field label="Référence de transaction" hint="Saisie manuelle — aucun prélèvement n'est effectué par l'application.">
                <input className="field num" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} data-testid="input-payment-reference" />
              </Field>
            )}
            {cashBlocked && <InlineOpenCash />}
            <Err msg={error} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Submit pending={create.isPending} label="Enregistrer le paiement" disabled={cashBlocked || due <= 0} />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InlineOpenCash() {
  const [bal, setBal] = useState("0");
  const [error, setError] = useState("");
  const setCash = useSetCashSession();
  const refresh = useRefresh();
  async function openCash() {
    setError("");
    try {
      await setCash.mutateAsync({ data: { action: "open", openingBalance: intOnly(bal) } });
      await refresh();
    } catch (err) {
      setError(errMsg(err));
    }
  }
  return (
    <div className="rounded-lg bg-accent text-accent-foreground px-3 py-3 space-y-2" data-testid="panel-open-cash">
      <div className="text-sm font-medium">La caisse est fermée. Ouvrez-la pour encaisser des espèces.</div>
      <div className="flex gap-2 items-center">
        <input className="field h-9 num" inputMode="numeric" value={bal} onChange={(e) => setBal(e.target.value.replace(/[^\d]/g, ""))} aria-label="Fond de caisse" data-testid="input-inline-opening" />
        <Button type="button" size="sm" onClick={openCash} disabled={setCash.isPending} data-testid="button-inline-open-cash">
          {setCash.isPending && <Loader2 className="size-3.5 mr-1 animate-spin" />} Ouvrir la caisse
        </Button>
      </div>
      <div className="text-[11px] opacity-80">Fond de caisse initial en FCFA. Vous pouvez aussi passer par la page Caisse.</div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

/* ---------------- Receipt viewer ---------------- */
export function ReceiptDialog({ open, onOpenChange, ws, payment }: Base & { ws: Workspace; payment: Payment | null }) {
  const { print } = usePrint();
  if (!payment) return null;
  const invoice = ws.invoices.find((i) => i.id === payment.invoiceId);
  const patient = ws.patients.find((p) => p.id === payment.patientId);
  const { before, after } = paymentBalances(payment, invoice, ws.payments);
  const doc = <ReceiptDoc payment={payment} invoice={invoice} patient={patient} settings={ws.settings} before={before} after={after} />;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Reçu {payment.receiptNumber}</DialogTitle>
          <DialogDescription>Aperçu avant impression. Utilisez « Enregistrer en PDF » dans la fenêtre d'impression pour un fichier.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-[hsl(42_45%_99%)] p-6 text-[#1a1a1a]">{doc}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={() => print(doc)} data-testid="button-print-receipt"><Printer className="size-4 mr-2" /> Imprimer le reçu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Expense ---------------- */
export function ExpenseDialog({ open, onOpenChange, ws }: Base & { ws: Workspace }) {
  const [f, setF] = useState({ label: "", supplier: "", category: "supplies" as ExpenseInputCategory, amount: "", method: "cash" as PaymentInputMethod });
  const [error, setError] = useState("");
  const create = useCreateExpense();
  const refresh = useRefresh();
  const { toast } = useToast();
  useEffect(() => {
    if (open) { setError(""); setF({ label: "", supplier: "", category: "supplies", amount: "", method: ws.cashSession.isOpen ? "cash" : "bank" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const a = intOnly(f.amount);
    if (!f.label.trim()) return setError("Indiquez le libellé de la dépense.");
    if (a < 1 || a > 100_000_000) return setError("Montant invalide.");
    const data: ExpenseInput = { label: f.label.trim(), supplier: f.supplier.trim(), category: f.category, amount: a, method: f.method };
    try {
      await create.mutateAsync({ data });
      await refresh();
      toast({ title: "Dépense enregistrée", description: `${data.label} · ${fcfa(a)}` });
      onOpenChange(false);
    } catch (err) {
      setError(errMsg(err));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle dépense</DialogTitle>
          <DialogDescription>Sortie d'argent enregistrée dans le journal de caisse.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Libellé"><input className="field" value={f.label} maxLength={300} onChange={(e) => setF({ ...f, label: e.target.value })} data-testid="input-expense-label" /></Field>
          <Field label="Fournisseur"><input className="field" value={f.supplier} maxLength={200} onChange={(e) => setF({ ...f, supplier: e.target.value })} data-testid="input-expense-supplier" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseInputCategory })} data-testid="select-expense-category">
                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <select className="field" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentInputMethod })} data-testid="select-expense-method">
                {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Montant (FCFA)"><input className="field num text-lg h-11" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-expense-amount" /></Field>
          <Err msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Submit pending={create.isPending} label="Enregistrer" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
