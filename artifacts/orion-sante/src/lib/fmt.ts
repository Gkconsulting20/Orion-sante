import type { Patient, Visit, VisitInput, Invoice, Payment } from "@workspace/api-client-react";

export const TZ = "Africa/Lome";
export const LOC = "fr-TG";

const nf = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
export const num = (n: number) => nf.format(Math.round(n || 0)).replace(/\u202f|\u00a0/g, " ");
export const fcfa = (n: number) => `${num(n)} FCFA`;

function safe(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
export const fDate = (iso?: string | null) => {
  const d = safe(iso);
  return d ? d.toLocaleDateString(LOC, { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }) : "—";
};
export const fDateLong = (iso?: string | null) => {
  const d = safe(iso);
  return d ? d.toLocaleDateString(LOC, { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—";
};
export const fTime = (iso?: string | null) => {
  const d = safe(iso);
  return d ? d.toLocaleTimeString(LOC, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—";
};
export const fDateTime = (iso?: string | null) => (safe(iso) ? `${fDate(iso)} · ${fTime(iso)}` : "—");

/** Africa/Lome is UTC+0, so ISO UTC day keys are Lomé day keys. */
export const dayKey = (iso: string) => {
  const d = safe(iso);
  return d ? d.toISOString().slice(0, 10) : "";
};
export const todayKey = () => new Date().toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const monthKey = (iso: string) => dayKey(iso).slice(0, 7);

export const toLocalInput = (iso?: string) => {
  const d = safe(iso);
  return d ? d.toISOString().slice(0, 16) : "";
};
export const nowLocalInput = () => {
  const d = new Date();
  d.setUTCSeconds(0, 0);
  return d.toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(`${v}:00Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export const age = (birth: string) => {
  const d = safe(birth);
  if (!d) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
};

export const fullName = (p?: Patient | null) => (p ? `${p.lastName.toUpperCase()} ${p.firstName}` : "Patient inconnu");
export const initials = (p?: Patient | null) => (p ? `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase() : "?");

export const METHOD: Record<string, string> = { cash: "Espèces", tmoney: "T-Money", flooz: "Flooz", bank: "Banque / virement" };
export const VISIT_STATUS: Record<string, string> = {
  scheduled: "Programmé",
  waiting: "En attente",
  in_progress: "En consultation",
  completed: "Terminé",
  cancelled: "Annulé",
};
export const INVOICE_STATUS: Record<string, string> = { unpaid: "Impayée", partial: "Partielle", paid: "Soldée" };
export const CATEGORY: Record<string, string> = {
  supplies: "Consommables",
  salary: "Salaires",
  utilities: "Eau / électricité",
  equipment: "Équipement",
  other: "Autre",
};

export const remaining = (inv: Invoice) => Math.max(0, inv.total - inv.paid);

export const visitToInput = (v: Visit): VisitInput => ({
  patientId: v.patientId,
  service: v.service,
  practitioner: v.practitioner,
  scheduledAt: v.scheduledAt,
  status: v.status,
  reason: v.reason ?? "",
  notes: v.notes ?? "",
  prescription: v.prescription ?? "",
  temperature: v.temperature ?? "",
  bloodPressure: v.bloodPressure ?? "",
  weight: v.weight ?? "",
});

/** Balance before & after a given payment, from the server-recorded payment history. */
export function paymentBalances(payment: Payment, invoice: Invoice | undefined, payments: Payment[]) {
  if (!invoice) return { before: payment.amount, after: 0 };
  const prior = payments
    .filter((p) => p.invoiceId === invoice.id && p.id !== payment.id)
    .filter((p) => p.createdAt < payment.createdAt || (p.createdAt === payment.createdAt && p.receiptNumber < payment.receiptNumber))
    .reduce((s, p) => s + p.amount, 0);
  const before = Math.max(0, invoice.total - prior);
  return { before, after: Math.max(0, before - payment.amount) };
}

export function errMsg(e: unknown): string {
  const any = e as { data?: { error?: string; message?: string }; message?: string } | undefined;
  return any?.data?.error || any?.data?.message || any?.message || "Une erreur est survenue.";
}

export const intOnly = (v: string) => {
  const n = Math.round(Number(String(v).replace(/\s/g, "")));
  return Number.isFinite(n) ? n : 0;
};
