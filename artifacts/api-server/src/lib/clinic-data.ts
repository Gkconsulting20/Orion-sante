import { randomUUID } from "node:crypto";
import { GetWorkspaceResponse } from "@workspace/api-zod";

export type ClinicData = Omit<ReturnType<typeof GetWorkspaceResponse.parse>, "isDemo" | "role">;
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const day = (date: string) => date.slice(0, 10);
export const today = () => day(now()); // Togo is UTC year round.

export function initialData(isDemo: boolean): ClinicData {
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
  };
  if (!isDemo) return data;
  data.patients = [
    { id: id(), number: "PAT-0001", firstName: "Afi", lastName: "Mensah", sex: "F", birthDate: "1992-05-14", phone: "+228 90 00 00 01", address: "Lomé — données fictives", emergencyContact: "Contact de démonstration", allergies: "Pénicilline (exemple fictif)", createdAt },
    { id: id(), number: "PAT-0002", firstName: "Kossi", lastName: "Lawson", sex: "M", birthDate: "1984-09-20", phone: "+228 90 00 00 02", address: "Agoè — données fictives", emergencyContact: "", allergies: "", createdAt },
    { id: id(), number: "PAT-0003", firstName: "Akouvi", lastName: "Amégan", sex: "F", birthDate: "2018-03-08", phone: "+228 90 00 00 03", address: "Adidogomé — données fictives", emergencyContact: "Parent de démonstration", allergies: "", createdAt },
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
  data.expenses.push(
    { id: id(), label: "Consommables médicaux", supplier: "Fournisseur de démonstration", category: "supplies", amount: 12000, method: "bank", createdAt },
    { id: id(), label: "Électricité", supplier: "Exemple fictif", category: "utilities", amount: 5000, method: "tmoney", createdAt },
  );
  data.cashSession = { isOpen: true, openingBalance: 25000, openedAt: `${today()}T06:00:00.000Z`, closedAt: "", closingBalance: 0 };
  data.activity = [
    { id: id(), kind: "payment", label: "Règlement enregistré — démonstration", createdAt },
    { id: id(), kind: "patient", label: "Dossiers patients fictifs créés", createdAt },
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
