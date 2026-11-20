import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import {
  CreatePatientBody, CreatePatientResponse, UpdatePatientBody, UpdatePatientParams,
  CreateVisitBody, CreateVisitResponse, UpdateVisitBody, UpdateVisitParams,
  CreateInvoiceBody, CreateInvoiceResponse, CreatePaymentBody, CreatePaymentResponse,
  CreateExpenseBody, CreateExpenseResponse, UpdateSettingsBody, UpdateSettingsResponse,
  SetCashSessionBody, SetCashSessionResponse, GetWorkspaceResponse, GetDashboardResponse,
  CreateMemberBody, CreateMemberResponse, UpdateMemberBody, UpdateMemberParams, UpdateMemberResponse,
  DeleteMemberParams, DeleteMemberResponse, GetAuditLogQueryParams, GetAuditLogResponse,
  ExportPatientParams, ExportPatientResponse, DeletePatientParams, DeletePatientResponse,
  canRole, isClinicRole, ROLE_LABELS, type ClinicModule, type ClinicRole,
} from "@workspace/api-zod";
import { initialData, dashboard, id, now, today, cashBalance, auditLog, actorLabelFor, ensureClinicShape, type ClinicData } from "../lib/clinic-data";
import { PLATFORM_OWNER, clinicPlan, effectiveSubscriptionStatus, type PlatformData } from "../lib/platform-data";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();
class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(message: string, status = 400): never { throw new DomainError(status, message); }

function context(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  if (userId) return { owner: `user:${userId}`, isDemo: false, userId };
  let token = req.cookies?.orion_demo;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    res.cookie("orion_demo", token, {
      httpOnly: true, sameSite: "lax", secure: req.secure || req.get("x-forwarded-proto") === "https",
      maxAge: 7 * 86400000, path: "/",
    });
  }
  return { owner: `demo:${createHash("sha256").update(token).digest("hex")}`, isDemo: true, userId: null as string | null };
}

/** IDs utilisateur Clerk des administrateurs de la plateforme ORIONEXA (variable d'environnement ORIONEXA_ADMIN_IDS, séparée par des virgules). Vide par défaut : personne n'est admin tant que Cap n'a pas fourni son ID. */
export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ORIONEXA_ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

/**
 * Un membre d'une clinique (enregistré dans `members` par le propriétaire)
 * accède à LA clinique du propriétaire, pas à une clinique vide à son nom.
 * Sans membre trouvé, l'utilisateur accède à sa propre clinique.
 */
async function resolveClinicOwner(userId: string): Promise<string> {
  const own = `user:${userId}`;
  try {
    const rows = await db.execute(sql`select ${clinicsTable.owner} from ${clinicsTable} where ${clinicsTable.data} @> ${JSON.stringify({ members: [{ userId }] })}::jsonb and ${clinicsTable.owner} <> ${own} limit 1`);
    const found = (rows as unknown as { owner?: string }[])[0]?.owner;
    if (found) return found;
  } catch {
    // La recherche de clinique partagée ne doit jamais bloquer l'accès.
  }
  return own;
}

async function loadPlatform(): Promise<PlatformData | null> {
  const [row] = await db.select().from(clinicsTable).where(eq(clinicsTable.owner, PLATFORM_OWNER));
  return row ? (row.data as PlatformData) : null;
}

/**
 * Blocage à l'expiration : un abonnement (essai de 30 jours ou payant)
 * expiré bloque l'accès de la clinique, avec une erreur 403 explicite.
 * Ne s'applique pas à la démo, ni aux administrateurs de la plateforme, ni
 * aux cliniques sans abonnement (créées par connexion directe).
 */
async function assertSubscriptionActive(owner: string, userId: string | null) {
  if (!userId || isPlatformAdmin(userId)) return;
  const platform = await loadPlatform();
  if (!platform) return;
  const client = platform.clients.find((c) => c.ownerId === owner);
  if (!client) return;
  const sub = platform.subscriptions.find((s) => s.clientId === client.id && s.status === "active");
  if (!sub) return;
  if (effectiveSubscriptionStatus(sub) === "expired") {
    fail("Votre abonnement a expiré. Contactez ORIONEXA pour le renouveler et retrouver l'accès à votre clinique.", 403);
  }
}

function resolveRole(data: ClinicData, userId: string | null, isDemo: boolean): ClinicRole {
  if (isDemo || !userId) return "owner";
  const member = data.members.find((m) => m.userId === userId);
  return member && isClinicRole(member.role) ? member.role : "owner";
}

/** Journalise une action dans l'audit log de la clinique (métadonnées seulement). */
function audit(data: ClinicData, req: Request, action: string, entity: string, recordId: string, detail: string) {
  const userId = getAuth(req).userId;
  auditLog(data, userId ?? "demo", actorLabelFor(data, userId, !userId), action, entity, recordId, detail);
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

type WithClinicOpts = {
  userId?: string | null;
  perm?: { module: ClinicModule; write: boolean };
  requireOwner?: boolean;
  platform?: boolean;
};

async function withClinic<T>(owner: string, isDemo: boolean, write: boolean, action: (data: ClinicData, platform: PlatformData | null) => T, opts: WithClinicOpts = {}): Promise<T> {
  const ownerUserId = owner.startsWith("user:") ? owner.slice(5) : null;
  await db.insert(clinicsTable).values({ owner, data: initialData(isDemo, ownerUserId) }).onConflictDoNothing();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(clinicsTable).where(eq(clinicsTable.owner, owner)).for("update");
    if (!row) throw new Error("Clinic initialization failed");
    const data = row.data as ClinicData;
    ensureClinicShape(data, ownerUserId);
    const role = resolveRole(data, opts.userId ?? null, isDemo);
    if (opts.perm && !canRole(role, opts.perm.module, opts.perm.write ? "write" : "read")) {
      fail("Votre rôle ne permet pas cette action.", 403);
    }
    if (opts.requireOwner && role !== "owner") {
      fail("Cette action est réservée au propriétaire de la clinique.", 403);
    }
    let platform: PlatformData | null = null;
    if (opts.platform) {
      const [prow] = await tx.select().from(clinicsTable).where(eq(clinicsTable.owner, PLATFORM_OWNER));
      platform = prow ? (prow.data as PlatformData) : null;
    }
    const result = action(data, platform);
    if (write) await tx.update(clinicsTable).set({ data, updatedAt: new Date() }).where(eq(clinicsTable.owner, owner));
    return result;
  });
}

function activity(data: ClinicData, kind: string, label: string) {
  data.activity.unshift({ id: id(), kind, label, createdAt: now() });
  data.activity = data.activity.slice(0, 100);
}

type Schema<T> = { safeParse: (input: unknown) => { success: true; data: T } | { success: false } };
type ActionCtx = { platform: PlatformData | null; owner: string };
function mutation<T, R>(
  method: "post" | "put", path: string, schema: Schema<T>,
  output: { parse: (input: unknown) => R },
  action: (data: ClinicData, input: T, req: Request, ctx: ActionCtx) => unknown, status = 201,
  opts: { perm?: { module: ClinicModule; write: boolean }; requireOwner?: boolean; platform?: boolean } = {},
) {
  router[method](path, async (req, res): Promise<void> => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires et les montants saisis." }); return; }
    const ctx = context(req, res);
    const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
    try {
      await assertSubscriptionActive(owner, ctx.userId);
      const result = await withClinic(owner, ctx.isDemo, true,
        (data, platform) => output.parse(action(data, parsed.data, req, { platform, owner })),
        { userId: ctx.userId, perm: opts.perm, requireOwner: opts.requireOwner, platform: opts.platform });
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
  if (input.consentGiven && input.consentDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.consentDate)) {
    fail("La date de consentement est invalide.");
  }
}

/** Consentement normalisé : non coché par défaut, date du jour si coché sans date. */
function normalizeConsent(input: ReturnType<typeof CreatePatientBody.parse>) {
  const consentGiven = !!input.consentGiven;
  return {
    consentGiven,
    consentDate: consentGiven ? (input.consentDate || today()) : "",
    consentMethod: consentGiven ? (input.consentMethod ?? "oral") : undefined,
  };
}

function validateVisit(data: ClinicData, input: ReturnType<typeof CreateVisitBody.parse>) {
  requirePatient(data, input.patientId);
  if (!Number.isFinite(Date.parse(input.scheduledAt))) fail("La date de consultation est invalide.");
  if (!input.service.trim() || !input.practitioner.trim()) fail("Sélectionnez un service et un praticien.");
}

router.get("/workspace", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  await assertSubscriptionActive(owner, ctx.userId);
  const data = await withClinic(owner, ctx.isDemo, false, (d) => d, { userId: ctx.userId });
  const role = resolveRole(data, ctx.userId, ctx.isDemo);
  const platform = ctx.userId && !ctx.isDemo ? await loadPlatform() : null;
  const plan = clinicPlan(platform, owner);
  res.json(GetWorkspaceResponse.parse({ ...data, isDemo: ctx.isDemo, role, ...(plan ? { plan } : {}) }));
});
router.get("/dashboard", async (req, res): Promise<void> => {
  // Avoid racing to set a second demo cookie when the first two queries arrive
  // together. Workspace is the only initial cookie-setting read.
  if (!getAuth(req).userId && !req.cookies?.orion_demo) {
    res.setHeader("Cache-Control", "no-store");
    res.json(GetDashboardResponse.parse(dashboard(initialData(true)))); return;
  }
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  await assertSubscriptionActive(owner, ctx.userId);
  res.json(await withClinic(owner, ctx.isDemo, false, data => GetDashboardResponse.parse(dashboard(data)), { userId: ctx.userId }));
});

router.get("/audit-log", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  await assertSubscriptionActive(owner, ctx.userId);
  const params = GetAuditLogQueryParams.safeParse(req.query);
  const data = await withClinic(owner, ctx.isDemo, false, (d) => d, { userId: ctx.userId });
  let entries = [...data.auditLog];
  if (params.success) {
    const { action, entity, from, to } = params.data;
    if (action) entries = entries.filter((e) => e.action === action);
    if (entity) entries = entries.filter((e) => e.entity === entity);
    if (from) entries = entries.filter((e) => e.createdAt.slice(0, 10) >= from);
    if (to) entries = entries.filter((e) => e.createdAt.slice(0, 10) <= to);
  }
  res.json(GetAuditLogResponse.parse(entries.slice(0, 200)));
});

mutation("post", "/patients", CreatePatientBody, CreatePatientResponse, (data, input, req, ctx) => {
  validatePatient(input);
  const plan = clinicPlan(ctx.platform, ctx.owner);
  if (plan && data.patients.length >= plan.maxPatients) {
    fail(`Limite du plan « ${plan.name} » atteinte (${plan.maxPatients} patients maximum). Passez à un plan supérieur pour en ajouter.`, 403);
  }
  const patient = { ...input, ...normalizeConsent(input), id: id(), number: `PAT-${String(data.patients.length + 1).padStart(4, "0")}`, createdAt: now() };
  data.patients.unshift(patient);
  activity(data, "patient", `Dossier ${patient.number} créé`);
  audit(data, req, "patient.create", "patient", patient.number, `Dossier ${patient.number} créé`);
  return patient;
}, 201, { perm: { module: "patients", write: true }, platform: true });
mutation("put", "/patients/:id", UpdatePatientBody, CreatePatientResponse, (data, input, req) => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) fail("Identifiant invalide.");
  validatePatient(input);
  const patient = requirePatient(data, params.data.id);
  Object.assign(patient, input, normalizeConsent(input));
  activity(data, "patient", `Dossier ${patient.number} mis à jour`);
  audit(data, req, "patient.update", "patient", patient.number, `Dossier ${patient.number} mis à jour`);
  return patient;
}, 200, { perm: { module: "patients", write: true } });

router.delete("/patients/:id", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  try {
    await assertSubscriptionActive(owner, ctx.userId);
    const result = await withClinic(owner, ctx.isDemo, true, (data) => {
      const params = DeletePatientParams.safeParse(req.params);
      if (!params.success) fail("Identifiant invalide.");
      const patient = requirePatient(data, params.data.id);
      // Le patient, ses consultations et ses rendez-vous sont supprimés.
      // Les factures et paiements sont CONSERVÉS pour la comptabilité mais
      // anonymisés (affichés « Patient supprimé », sans téléphone ni adresse).
      data.patients = data.patients.filter((p) => p.id !== patient.id);
      data.visits = data.visits.filter((v) => v.patientId !== patient.id);
      for (const inv of data.invoices) if (inv.patientId === patient.id) inv.anonymized = true;
      for (const pay of data.payments) if (pay.patientId === patient.id) pay.anonymized = true;
      activity(data, "patient", `Dossier ${patient.number} supprimé`);
      audit(data, req, "patient.delete", "patient", patient.number, `Dossier ${patient.number} supprimé et anonymisé`);
      return DeletePatientResponse.parse({ ok: true });
    }, { userId: ctx.userId, perm: { module: "patients", write: true }, requireOwner: true });
    res.json(result);
  } catch (error) {
    if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.get("/patients/:id/export", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  try {
    await assertSubscriptionActive(owner, ctx.userId);
    const result = await withClinic(owner, ctx.isDemo, true, (data) => {
      const params = ExportPatientParams.safeParse(req.params);
      if (!params.success) fail("Identifiant invalide.");
      const patient = requirePatient(data, params.data.id);
      const role = resolveRole(data, ctx.userId, ctx.isDemo);
      if (role !== "owner" && role !== "doctor") {
        fail("L'export des données est réservé au propriétaire et au médecin.", 403);
      }
      audit(data, req, "patient.export", "patient", patient.number, `Export des données du dossier ${patient.number}`);
      return ExportPatientResponse.parse({
        patient,
        visits: data.visits.filter((v) => v.patientId === patient.id),
        invoices: data.invoices.filter((i) => i.patientId === patient.id),
        payments: data.payments.filter((p) => p.patientId === patient.id),
      });
    }, { userId: ctx.userId });
    res.json(result);
  } catch (error) {
    if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

mutation("post", "/members", CreateMemberBody, CreateMemberResponse, (data, input, req, ctx) => {
  const plan = clinicPlan(ctx.platform, ctx.owner);
  if (plan && data.members.length >= plan.maxUsers) {
    fail(`Limite du plan « ${plan.name} » atteinte (${plan.maxUsers} utilisateurs maximum). Passez à un plan supérieur pour en ajouter.`, 403);
  }
  if (data.members.some((m) => m.userId === input.userId)) fail("Cet utilisateur est déjà membre de la clinique.", 409);
  if (!isClinicRole(input.role)) fail("Rôle invalide.");
  const member = { ...input };
  data.members.push(member);
  audit(data, req, "member.add", "member", member.userId, `Membre ajouté — ${ROLE_LABELS[member.role]}`);
  return member;
}, 201, { perm: { module: "parametres", write: true }, platform: true });
mutation("put", "/members/:userId", UpdateMemberBody, UpdateMemberResponse, (data, input, req, ctx) => {
  const params = UpdateMemberParams.safeParse(req.params);
  if (!params.success) fail("Identifiant invalide.");
  const member = data.members.find((m) => m.userId === params.data.userId);
  if (!member) fail("Membre introuvable.", 404);
  if (!isClinicRole(input.role)) fail("Rôle invalide.");
  const ownerUserId = ctx.owner.startsWith("user:") ? ctx.owner.slice(5) : null;
  if (member.userId === ownerUserId && input.role !== "owner") {
    fail("Le propriétaire de la clinique ne peut pas être rétrogradé.", 400);
  }
  member.role = input.role;
  audit(data, req, "member.role", "member", member.userId, `Rôle modifié — ${ROLE_LABELS[input.role]}`);
  return member;
}, 200, { perm: { module: "parametres", write: true } });

router.delete("/members/:userId", async (req, res): Promise<void> => {
  const ctx = context(req, res);
  const owner = ctx.userId ? await resolveClinicOwner(ctx.userId) : ctx.owner;
  try {
    await assertSubscriptionActive(owner, ctx.userId);
    const result = await withClinic(owner, ctx.isDemo, true, (data) => {
      const params = DeleteMemberParams.safeParse(req.params);
      if (!params.success) fail("Identifiant invalide.");
      const ownerUserId = owner.startsWith("user:") ? owner.slice(5) : null;
      if (params.data.userId === ownerUserId) fail("Le propriétaire de la clinique ne peut pas être retiré.", 400);
      const idx = data.members.findIndex((m) => m.userId === params.data.userId);
      if (idx < 0) fail("Membre introuvable.", 404);
      data.members.splice(idx, 1);
      audit(data, req, "member.remove", "member", params.data.userId, "Membre retiré de la clinique");
      return DeleteMemberResponse.parse({ ok: true });
    }, { userId: ctx.userId, perm: { module: "parametres", write: true } });
    res.json(result);
  } catch (error) {
    if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

mutation("post", "/visits", CreateVisitBody, CreateVisitResponse, (data, input, req) => {
  validateVisit(data, input);
  const visit = { ...input, scheduledAt: new Date(input.scheduledAt).toISOString(), id: id(), createdAt: now() };
  data.visits.unshift(visit);
  activity(data, "visit", `Consultation enregistrée — ${visit.service}`);
  audit(data, req, "visit.create", "visit", visit.id, `Consultation enregistrée — ${visit.service}`);
  return visit;
}, 201, { perm: { module: "consultations", write: true } });
mutation("put", "/visits/:id", UpdateVisitBody, CreateVisitResponse, (data, input, req) => {
  const params = UpdateVisitParams.safeParse(req.params);
  if (!params.success) fail("Identifiant invalide.");
  validateVisit(data, input);
  const visit = data.visits.find(v => v.id === params.data.id);
  if (!visit) fail("Consultation introuvable.", 404);
  if (input.patientId !== visit.patientId) fail("Le patient d’une consultation ne peut pas être modifié.");
  Object.assign(visit, input, { scheduledAt: new Date(input.scheduledAt).toISOString() });
  activity(data, "visit", `Consultation mise à jour — ${visit.service}`);
  audit(data, req, "visit.update", "visit", visit.id, `Consultation mise à jour — ${visit.service}`);
  return visit;
}, 200, { perm: { module: "consultations", write: true } });
mutation("post", "/invoices", CreateInvoiceBody, CreateInvoiceResponse, (data, input, req) => {
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
  audit(data, req, "invoice.create", "invoice", invoice.number, `Facture ${invoice.number} créée — ${total.toLocaleString("fr-FR")} FCFA`);
  return invoice;
}, 201, { perm: { module: "facturation", write: true } });
mutation("post", "/payments", CreatePaymentBody, CreatePaymentResponse, (data, input, req) => {
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
  audit(data, req, "payment.create", "payment", payment.receiptNumber, `Règlement ${payment.receiptNumber} — ${input.amount.toLocaleString("fr-FR")} FCFA`);
  return payment;
}, 201, { perm: { module: "facturation", write: true } });
mutation("post", "/expenses", CreateExpenseBody, CreateExpenseResponse, (data, input, req) => {
  if (!input.label.trim()) fail("Le libellé de dépense est obligatoire.");
  if (input.method === "cash" && !data.cashSession.isOpen) fail("Ouvrez la caisse avant une dépense en espèces.", 409);
  if (input.method === "cash" && input.amount > cashBalance(data)) fail("Le solde en espèces est insuffisant.", 409);
  const expense = { ...input, id: id(), createdAt: now() };
  data.expenses.unshift(expense);
  activity(data, "expense", `Dépense enregistrée — ${expense.label}`);
  audit(data, req, "expense.create", "expense", expense.id, `Dépense enregistrée — ${expense.label}`);
  return expense;
}, 201, { perm: { module: "caisse", write: true } });
mutation("put", "/settings", UpdateSettingsBody, UpdateSettingsResponse, (data, input, req) => {
  if (!input.clinicName.trim() || input.services.some(s => !s.name.trim() || !Number.isSafeInteger(s.price))) fail("Vérifiez le nom de l’établissement et les tarifs.");
  if (new Set(input.services.map(s => s.id)).size !== input.services.length) fail("Les identifiants de services doivent être uniques.");
  data.settings = input;
  activity(data, "settings", "Paramètres de l’établissement mis à jour");
  audit(data, req, "settings.update", "settings", "clinic", "Paramètres de l’établissement mis à jour");
  return input;
}, 200, { perm: { module: "parametres", write: true } });
mutation("post", "/cash-session", SetCashSessionBody, SetCashSessionResponse, (data, input, req) => {
  if (input.action === "open") {
    if (data.cashSession.isOpen) fail("La caisse est déjà ouverte.", 409);
    data.cashSession = { isOpen: true, openingBalance: input.openingBalance, openedAt: now(), closedAt: "", closingBalance: 0 };
    activity(data, "cash", "Caisse ouverte");
    audit(data, req, "cash.open", "cash", "session", "Caisse ouverte");
  } else {
    if (!data.cashSession.isOpen) fail("La caisse est déjà fermée.", 409);
    data.cashSession.closingBalance = cashBalance(data);
    data.cashSession.closedAt = now();
    data.cashSession.isOpen = false;
    activity(data, "cash", `Caisse clôturée — ${data.cashSession.closingBalance.toLocaleString("fr-FR")} FCFA`);
    audit(data, req, "cash.close", "cash", "session", `Caisse clôturée — ${data.cashSession.closingBalance.toLocaleString("fr-FR")} FCFA`);
  }
  return data.cashSession;
}, 200, { perm: { module: "caisse", write: true } });

export default router;
