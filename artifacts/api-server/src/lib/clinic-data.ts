import { randomUUID } from "node:crypto";
import { GetWorkspaceResponse, type AuditLogEntry, type ClinicRole } from "@workspace/api-zod";

export type ClinicData = Omit<ReturnType<typeof GetWorkspaceResponse.parse>, "isDemo" | "role">;
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const day = (date: string) => date.slice(0, 10);
export const today = () => day(now()); // Togo is UTC year round.

/**
 * Journal d'audit de la clinique. Métadonnées seulement : jamais de données
 * médicales, jamais de diagnostic, jamais de contenu clinique. Le numéro de
 * dossier (PAT-0001) suffit à retrouver l'enregistrement concerné.
 */
export function auditLog(
  data: ClinicData,
  actorId: string,
  actorLabel: string,
  action: string,
  entity: string,
  recordId: string,
  detail: string,
) {
  const entry: AuditLogEntry = { id: id(), createdAt: now(), actorId, actorLabel, action, entity, recordId, detail };
  data.auditLog.unshift(entry);
  data.auditLog = data.auditLog.slice(0, 500);
}

/** Libellé de l'acteur pour le journal : nom du membre, sinon son rôle. */
export function actorLabelFor(data: ClinicData, userId: string | null, isDemo: boolean): string {
  if (isDemo) return "Démonstration";
  if (!userId) return "Inconnu";
  const member = data.members.find((m) => m.userId === userId);
  return member?.name?.trim() || member?.email || "Propriétaire";
}

/**
 * Normalise les lignes créées avant l'ajout de la protection des données :
 * membres et journal absents, consentement non renseigné. Appelé à chaque
 * chargement de la clinique, en mémoire ; persisté uniquement lors d'une
 * écriture (withClinic write=true).
 */
export function ensureClinicShape(data: ClinicData, ownerUserId: string | null) {
  if (!Array.isArray(data.members)) data.members = [];
  if (data.members.length === 0 && ownerUserId) {
    data.members.push({ userId: ownerUserId, name: "", email: "", role: "owner" as ClinicRole });
  }
  if (!Array.isArray(data.auditLog)) data.auditLog = [];
  for (const p of data.patients) {
    if (typeof p.consentGiven !== "boolean") p.consentGiven = false;
    if (p.consentGiven && !p.consentDate) p.consentDate = day(p.createdAt);
    if (p.consentGiven && !p.consentMethod) p.consentMethod = "oral";
  }
}

export function initialData(isDemo: boolean, ownerUserId?: string | null): ClinicData {
  const createdAt = now();
  const settings: ClinicData["settings"] = {
    clinicName: isDemo ? "Clinique de démonstration" : "Mon établissement",
    address: "Lomé, Togo",
    phone: "",
    email: "",
    receiptFooter: "Merci de votre confiance. Conservez ce reçu.",
    services: [
      { id: "general", name: "Médecine générale", price: 5000 },
      { id: "pediatric", name: "Pédiatrie", price: 7500 },
      { id: "gyneco", name: "Gynécologie", price: 10000 },
      { id: "lab", name: "Laboratoire", price: 3500 },
      { id: "imaging", name: "Imagerie médicale", price: 15000 },
      { id: "nursing", name: "Soins infirmiers", price: 2500 },
    ],
    practitioners: ["Dr Mensah", "Dr Lawson", "Dr Amégan"],
  };
  const data: ClinicData = {
    settings, patients: [], visits: [], invoices: [], payments: [], expenses: [],
    cashSession: { isOpen: false, openingBalance: 0, openedAt: "", closedAt: "", closingBalance: 0 },
    activity: [],
    members: isDemo
      ? [{ userId: "demo", name: "Démonstration", email: "", role: "owner" as ClinicRole }]
      : ownerUserId
        ? [{ userId: ownerUserId, name: "", email: "", role: "owner" as ClinicRole }]
        : [],
    auditLog: [],
  };
  if (!isDemo) return data;
  data.patients = [
    { id: id(), number: "PAT-0001", firstName: "Afi", lastName: "Mensah", sex: "F", birthDate: "1992-05-14", phone: "+228 90 00 00 01", address: "Lomé — données fictives", emergencyContact: "Contact de démonstration", allergies: "Pénicilline (exemple fictif)", consentGiven: true, consentDate: today(), consentMethod: "écrit", createdAt },
    { id: id(), number: "PAT-0002", firstName: "Kossi", lastName: "Lawson", sex: "M", birthDate: "1984-09-20", phone: "+228 90 00 00 02", address: "Agoè — données fictives", emergencyContact: "", allergies: "", consentGiven: false, createdAt },
    { id: id(), number: "PAT-0003", firstName: "Akouvi", lastName: "Amégan", sex: "F", birthDate: "2018-03-08", phone: "+228 90 00 00 03", address: "Adidogomé — données fictives", emergencyContact: "Parent de démonstration", allergies: "", consentGiven: true, consentDate: today(), consentMethod: "oral", createdAt },
  ];
  data.visits = data.patients.map((p, i) => ({
    id: id(), patientId: p.id, service: settings.services[i]!.name,
    practitioner: settings.practitioners[i]!, scheduledAt: `${today()}T${["09:00", "10:30", "14:00"][i]}:00.000Z`,
    status: (["completed", "waiting", "scheduled"] as const)[i]!,
    reason: ["Consultation de contrôle", "Consultation générale", "Suivi pédiatrique"][i]!,
    notes: i === 0 ? "Exemple fictif de consultation. Aucun dossier médical réel." : "",
    prescription: "", temperature: i === 0 ? "36.8" : "", bloodPressure: i === 0 ? "120/80" : "", weight: "", createdAt,
  }));
  // Example receipts across the last week, computed from real stored invoices.
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - i));
    date.setUTCHours(8 + i, 0, 0, 0);
    const timestamp = date.toISOString();
    const patient = data.patients[i % 3]!;
    const total = [15000, 7500, 25000, 12500, 20000, 10000, 15000][i]!;
    const paid = i === 6 ? 5000 : total;
    const invoiceId = id();
    data.invoices.push({
      id: invoiceId, number: `FAC-${date.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`,
      patientId: patient.id, service: settings.services[i % 3]!.name,
      lines: [{ label: settings.services[i % 3]!.name, quantity: 1, unitPrice: total }],
      total, paid, status: paid === total ? "paid" : "partial", createdAt: timestamp,
    });
    data.payments.push({
      id: id(), invoiceId, patientId: patient.id, amount: paid,
      method: (["cash", "tmoney", "flooz"] as const)[i % 3]!,
      reference: "DÉMONSTRATION", requestId: id(),
      receiptNumber: `REC-${date.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`, createdAt: timestamp,
    });
  }
  // La caisse ouvre aujourd'hui à 06:00 avec les espèces déjà en caisse : les
  // règlements en espèces des jours précédents, non encore versés en banque.
  // Ainsi le circuit de l'argent se boucle : espèces reçues − espèces dépensées
  // = espèces attendues en caisse. Les dépenses sont horodatées après
  // l'ouverture pour appartenir à la session ; l'une d'elles est en espèces
  // afin que le circuit des sorties de caisse soit visible dans la démo.
  const sessionOpenedAt = `${today()}T06:00:00.000Z`;
  const cashBeforeSession = data.payments
    .filter((p) => p.method === "cash" && p.createdAt < sessionOpenedAt)
    .reduce((s, p) => s + p.amount, 0);
  data.expenses.push(
    { id: id(), label: "Consommables médicaux", supplier: "Fournisseur de démonstration", category: "supplies", amount: 12000, method: "bank", createdAt: `${today()}T09:00:00.000Z` },
    { id: id(), label: "Électricité", supplier: "Exemple fictif", category: "utilities", amount: 5000, method: "cash", createdAt: `${today()}T10:00:00.000Z` },
  );
  data.cashSession = { isOpen: true, openingBalance: cashBeforeSession, openedAt: sessionOpenedAt, closedAt: "", closingBalance: 0 };
  data.activity = [
    { id: id(), kind: "payment", label: "Règlement enregistré — démonstration", createdAt },
    { id: id(), kind: "patient", label: "Dossiers patients fictifs créés", createdAt },
  ];
  // Journal d'audit fictif, cohérent avec les données de démonstration.
  data.auditLog = [
    { id: id(), createdAt, actorId: "demo", actorLabel: "Démonstration", action: "payment.create", entity: "payment", recordId: "REC-1", detail: "Règlement REC-1 — 15 000 FCFA" },
    { id: id(), createdAt, actorId: "demo", actorLabel: "Démonstration", action: "patient.create", entity: "patient", recordId: "PAT-0001", detail: "Dossier PAT-0001 créé" },
    { id: id(), createdAt, actorId: "demo", actorLabel: "Démonstration", action: "cash.open", entity: "cash", recordId: "session", detail: "Caisse ouverte" },
  ];
  return data;
}

export function dashboard(data: ClinicData) {
  const current = today();
  const month = current.slice(0, 7);
  const sum = <T extends { amount: number }>(items: T[]) => items.reduce((n, i) => n + i.amount, 0);
  const visitsToday = data.visits.filter(v => day(v.scheduledAt) === current && v.status !== "cancelled");
  return {
    patientsTotal: data.patients.length,
    patientsToday: data.patients.filter(p => day(p.createdAt) === current).length,
    visitsToday: visitsToday.length,
    waitingToday: visitsToday.filter(v => v.status === "waiting").length,
    receiptsToday: sum(data.payments.filter(p => day(p.createdAt) === current)),
    receiptsMonth: sum(data.payments.filter(p => p.createdAt.startsWith(month))),
    expensesMonth: sum(data.expenses.filter(e => e.createdAt.startsWith(month))),
    unpaidTotal: data.invoices.reduce((n, i) => n + i.total - i.paid, 0),
    revenue: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const date = day(d.toISOString());
      return { date, receipts: sum(data.payments.filter(p => day(p.createdAt) === date)), expenses: sum(data.expenses.filter(e => day(e.createdAt) === date)) };
    }),
    services: Array.from(new Set([...data.settings.services.map(s => s.name), ...data.invoices.map(i => i.service)]))
      .map(name => {
        const invoices = data.invoices.filter(i => i.service === name && i.createdAt.startsWith(month));
        const serviceInvoices = new Set(data.invoices.filter(i => i.service === name).map(i => i.id));
        const receipts = data.payments.filter(p => p.createdAt.startsWith(month) && serviceInvoices.has(p.invoiceId));
        return { name, count: invoices.length, amount: sum(receipts) };
      }),
  };
}

export function cashBalance(data: ClinicData) {
  const session = data.cashSession;
  const incoming = data.payments.filter(p => p.method === "cash" && p.createdAt >= session.openedAt).reduce((s, p) => s + p.amount, 0);
  const outgoing = data.expenses.filter(p => p.method === "cash" && p.createdAt >= session.openedAt).reduce((s, p) => s + p.amount, 0);
  return session.openingBalance + incoming - outgoing;
}
