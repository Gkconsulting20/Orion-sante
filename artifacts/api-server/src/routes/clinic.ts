import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import {
  CreatePatientBody, CreatePatientResponse, UpdatePatientBody, UpdatePatientParams,
  CreateVisitBody, CreateVisitResponse, UpdateVisitBody, UpdateVisitParams,
  CreateInvoiceBody, CreateInvoiceResponse, CreatePaymentBody, CreatePaymentResponse,
  CreateExpenseBody, CreateExpenseResponse, UpdateSettingsBody, UpdateSettingsResponse,
  SetCashSessionBody, SetCashSessionResponse, GetWorkspaceResponse, GetDashboardResponse,
} from "@workspace/api-zod";
import { initialData, dashboard, id, now, cashBalance, type ClinicData } from "../lib/clinic-data";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();
class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(message: string, status = 400): never { throw new DomainError(status, message); }

function context(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  if (userId) return { owner: `user:${userId}`, isDemo: false };
  let token = req.cookies?.orion_demo;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    res.cookie("orion_demo", token, {
      httpOnly: true, sameSite: "lax", secure: req.secure || req.get("x-forwarded-proto") === "https",
      maxAge: 7 * 86400000, path: "/",
    });
  }
  return { owner: `demo:${createHash("sha256").update(token).digest("hex")}`, isDemo: true };
}

// Mutations are same-origin only. Each account owns its own clinic; anonymous
// examples use an opaque HttpOnly browser cookie, never the signed-in clinic.
router.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== getClerkProxyHost(req)) {
          res.status(403).json({ error: "Origine de la requête non autorisée." }); return;
        }
      } catch { res.status(403).json({ error: "Origine invalide." }); return; }
    }
  }
  next();
});

async function withClinic<T>(owner: string, isDemo: boolean, write: boolean, action: (data: ClinicData) => T): Promise<T> {
  await db.insert(clinicsTable).values({ owner, data: initialData(isDemo) }).onConflictDoNothing();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(clinicsTable).where(eq(clinicsTable.owner, owner)).for("update");
    if (!row) throw new Error("Clinic initialization failed");
    const data = row.data as ClinicData;
    const result = action(data);
    if (write) await tx.update(clinicsTable).set({ data, updatedAt: new Date() }).where(eq(clinicsTable.owner, owner));
    return result;
  });
}

function activity(data: ClinicData, kind: string, label: string) {
  data.activity.unshift({ id: id(), kind, label, createdAt: now() });
  data.activity = data.activity.slice(0, 100);
}

type Schema<T> = { safeParse: (input: unknown) => { success: true; data: T } | { success: false } };
function mutation<T, R>(
  method: "post" | "put", path: string, schema: Schema<T>,
  output: { parse: (input: unknown) => R },
  action: (data: ClinicData, input: T, req: Request) => unknown, status = 201,
) {
  router[method](path, async (req, res): Promise<void> => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires et les montants saisis." }); return; }
    const ctx = context(req, res);
    try {
      const result = await withClinic(ctx.owner, ctx.isDemo, true, data => output.parse(action(data, parsed.data, req)));
      res.status(status).json(result);
    } catch (error) {
      if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
  });
}

function requirePatient(data: ClinicData, patientId: string) {
  const patient = data.patients.find(p => p.id === patientId);
  if (!patient) fail("Dossier patient introuvable.", 404);
  return patient;
}

function validatePatient(input: ReturnType<typeof CreatePatientBody.parse>) {
  if (!input.firstName.trim() || !input.lastName.trim()) fail("Le nom et le prénom sont obligatoires.");
  const birth = new Date(`${input.birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || !Number.isFinite(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== input.birthDate || birth > new Date() || birth.getUTCFullYear() < 1850) {
    fail("La date de naissance est invalide.");
  }
}

function validateVisit(data: ClinicData, input: ReturnType<typeof CreateVisitBody.parse>) {
  requirePatient(data, input.patientId);
  if (!Number.isFinite(Date.parse(input.scheduledAt))) fail("La date de consultation est invalide.");
  if (!input.service.trim() || !input.practitioner.trim()) fail("Sélectionnez un service et un praticien.");
}

router.get("/workspace", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const result = await withClinic(ctx.owner, ctx.isDemo, false, data =>
    GetWorkspaceResponse.parse({ ...data, isDemo: ctx.isDemo, role: ctx.isDemo ? "demo" : "owner" }));
  res.json(result);
});
router.get("/dashboard", async (req, res): Promise<void> => {
  // Avoid racing to set a second demo cookie when the first two queries arrive
  // together. Workspace is the only initial cookie-setting read.
  if (!getAuth(req).userId && !req.cookies?.orion_demo) {
    res.setHeader("Cache-Control", "no-store");
    res.json(GetDashboardResponse.parse(dashboard(initialData(true)))); return;
  }
  const ctx = context(req, res);
  res.json(await withClinic(ctx.owner, ctx.isDemo, false, data => GetDashboardResponse.parse(dashboard(data))));
});

mutation("post", "/patients", CreatePatientBody, CreatePatientResponse, (data, input) => {
  validatePatient(input);
  const patient = { ...input, id: id(), number: `PAT-${String(data.patients.length + 1).padStart(4, "0")}`, createdAt: now() };
  data.patients.unshift(patient);
  activity(data, "patient", `Dossier ${patient.number} créé`);
  return patient;
});
mutation("put", "/patients/:id", UpdatePatientBody, CreatePatientResponse, (data, input, req) => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) fail("Identifiant invalide.");
  validatePatient(input);
  const patient = requirePatient(data, params.data.id);
  Object.assign(patient, input);
  activity(data, "patient", `Dossier ${patient.number} mis à jour`);
  return patient;
}, 200);
mutation("post", "/visits", CreateVisitBody, CreateVisitResponse, (data, input) => {
  validateVisit(data, input);
  const visit = { ...input, scheduledAt: new Date(input.scheduledAt).toISOString(), id: id(), createdAt: now() };
  data.visits.unshift(visit);
  activity(data, "visit", `Consultation enregistrée — ${visit.service}`);
  return visit;
});
mutation("put", "/visits/:id", UpdateVisitBody, CreateVisitResponse, (data, input, req) => {
  const params = UpdateVisitParams.safeParse(req.params);
  if (!params.success) fail("Identifiant invalide.");
  validateVisit(data, input);
  const visit = data.visits.find(v => v.id === params.data.id);
  if (!visit) fail("Consultation introuvable.", 404);
  if (input.patientId !== visit.patientId) fail("Le patient d’une consultation ne peut pas être modifié.");
  Object.assign(visit, input, { scheduledAt: new Date(input.scheduledAt).toISOString() });
  activity(data, "visit", `Consultation mise à jour — ${visit.service}`);
  return visit;
}, 200);
mutation("post", "/invoices", CreateInvoiceBody, CreateInvoiceResponse, (data, input) => {
  requirePatient(data, input.patientId);
  if (input.visitId && !data.visits.some(v => v.id === input.visitId && v.patientId === input.patientId)) fail("La consultation ne correspond pas au patient.");
  const total = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000) fail("Le total doit être compris entre 1 et 100 000 000 FCFA.");
  const invoice = {
    ...input, id: id(), number: `FAC-${new Date().getUTCFullYear()}-${String(data.invoices.length + 1).padStart(4, "0")}`,
    total, paid: 0, status: "unpaid" as const, createdAt: now(),
  };
  data.invoices.unshift(invoice);
  activity(data, "invoice", `Facture ${invoice.number} créée`);
  return invoice;
});
mutation("post", "/payments", CreatePaymentBody, CreatePaymentResponse, (data, input) => {
  const previous = data.payments.find(p => p.requestId === input.requestId);
  if (previous) {
    if (previous.invoiceId !== input.invoiceId || previous.amount !== input.amount || previous.method !== input.method || previous.reference !== input.reference) fail("Cette référence de demande a déjà été utilisée.", 409);
    return previous;
  }
  const invoice = data.invoices.find(i => i.id === input.invoiceId);
  if (!invoice) fail("Facture introuvable.", 404);
  if (input.amount > invoice.total - invoice.paid) fail("Le règlement dépasse le reste à payer.");
  if (input.method === "cash" && !data.cashSession.isOpen) fail("Ouvrez la caisse avant un règlement en espèces.", 409);
  const payment = {
    ...input, id: id(), patientId: invoice.patientId, createdAt: now(),
    receiptNumber: `REC-${new Date().getUTCFullYear()}-${String(data.payments.length + 1).padStart(4, "0")}`,
  };
  data.payments.unshift(payment);
  invoice.paid += input.amount;
  invoice.status = invoice.paid === invoice.total ? "paid" : "partial";
  activity(data, "payment", `Reçu ${payment.receiptNumber} — ${input.amount.toLocaleString("fr-FR")} FCFA`);
  return payment;
});
mutation("post", "/expenses", CreateExpenseBody, CreateExpenseResponse, (data, input) => {
  if (!input.label.trim()) fail("Le libellé de dépense est obligatoire.");
  if (input.method === "cash" && !data.cashSession.isOpen) fail("Ouvrez la caisse avant une dépense en espèces.", 409);
  if (input.method === "cash" && input.amount > cashBalance(data)) fail("Le solde en espèces est insuffisant.", 409);
  const expense = { ...input, id: id(), createdAt: now() };
  data.expenses.unshift(expense);
  activity(data, "expense", `Dépense enregistrée — ${expense.label}`);
  return expense;
});
mutation("put", "/settings", UpdateSettingsBody, UpdateSettingsResponse, (data, input) => {
  if (!input.clinicName.trim() || input.services.some(s => !s.name.trim() || !Number.isSafeInteger(s.price))) fail("Vérifiez le nom de l’établissement et les tarifs.");
  if (new Set(input.services.map(s => s.id)).size !== input.services.length) fail("Les identifiants de services doivent être uniques.");
  data.settings = input;
  activity(data, "settings", "Paramètres de l’établissement mis à jour");
  return input;
}, 200);
mutation("post", "/cash-session", SetCashSessionBody, SetCashSessionResponse, (data, input) => {
  if (input.action === "open") {
    if (data.cashSession.isOpen) fail("La caisse est déjà ouverte.", 409);
    data.cashSession = { isOpen: true, openingBalance: input.openingBalance, openedAt: now(), closedAt: "", closingBalance: 0 };
    activity(data, "cash", "Caisse ouverte");
  } else {
    if (!data.cashSession.isOpen) fail("La caisse est déjà fermée.", 409);
    data.cashSession.closingBalance = cashBalance(data);
    data.cashSession.closedAt = now();
    data.cashSession.isOpen = false;
    activity(data, "cash", `Caisse clôturée — ${data.cashSession.closingBalance.toLocaleString("fr-FR")} FCFA`);
  }
  return data.cashSession;
}, 200);

export default router;
