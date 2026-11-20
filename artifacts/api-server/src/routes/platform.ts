import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import {
  CreatePlatformClientBody, CreatePlatformClientResponse,
  UpdatePlatformClientBody, UpdatePlatformClientParams, UpdatePlatformClientResponse,
  DeletePlatformClientParams, DeletePlatformClientResponse,
  CreatePlatformSalespersonBody, CreatePlatformSalespersonResponse,
  UpdatePlatformSalespersonBody, UpdatePlatformSalespersonParams, UpdatePlatformSalespersonResponse,
  DeletePlatformSalespersonParams, DeletePlatformSalespersonResponse,
  CreatePlatformPlanBody, CreatePlatformPlanResponse,
  UpdatePlatformPlanBody, UpdatePlatformPlanParams, UpdatePlatformPlanResponse,
  DeletePlatformPlanParams, DeletePlatformPlanResponse,
  CreatePlatformSubscriptionBody, CreatePlatformSubscriptionResponse,
  CancelPlatformSubscriptionParams,
  GetPlatformClientsResponse, GetPlatformSalespeopleResponse, GetPlatformPlansResponse,
  GetPlatformSubscriptionsResponse, GetPlatformSalesResponse, GetPlatformDashboardResponse,
  GetPlatformMeResponse, GetPlatformTrialStatusResponse,
  StartPlatformTrialBody, StartPlatformTrialResponse,
  type PlatformClient,
} from "@workspace/api-zod";
import { id, now, today } from "../lib/clinic-data";
import { PLATFORM_OWNER, initialPlatformData, platformAudit, addMonths, daysUntil, effectiveSubscriptionStatus, type PlatformData } from "../lib/platform-data";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { isPlatformAdmin } from "./clinic";

const router: IRouter = Router();
class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(message: string, status = 400): never { throw new DomainError(status, message); }

// Mutations are same-origin only.
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

async function withPlatform<T>(write: boolean, action: (data: PlatformData) => T): Promise<T> {
  await db.insert(clinicsTable).values({ owner: PLATFORM_OWNER, data: initialPlatformData() }).onConflictDoNothing();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(clinicsTable).where(eq(clinicsTable.owner, PLATFORM_OWNER)).for("update");
    if (!row) throw new Error("Platform initialization failed");
    const data = row.data as PlatformData;
    const result = action(data);
    if (write) await tx.update(clinicsTable).set({ data, updatedAt: new Date() }).where(eq(clinicsTable.owner, PLATFORM_OWNER));
    return result;
  });
}

function actorId(req: Request): string {
  return getAuth(req).userId ?? "admin";
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isPlatformAdmin(getAuth(req).userId)) {
    res.status(403).json({ error: "Accès réservé à l'administration de la plateforme ORIONEXA." });
    return;
  }
  next();
}

/** Publique : indique si l'utilisateur courant administre la plateforme. En démo (sans session), toujours faux. */
router.get("/platform/me", (req, res): void => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetPlatformMeResponse.parse({ isPlatformAdmin: isPlatformAdmin(getAuth(req).userId) }));
});

// ---------- Essai gratuit en libre-service ----------
// Ces deux routes ne sont PAS réservées aux administrateurs : toute clinique
// connectée peut connaître l'état de son essai et le démarrer elle-même.
// Elles sont déclarées avant `router.use("/platform", requireAdmin)`.
// La démo (sans session Clerk) reçoit 401 : aucun essai en mode anonyme.

/**
 * État de l'essai gratuit d'une clinique (par son identifiant de compte
 * `user:<id Clerk>`) : pas d'essai, essai actif, essai expiré ou essai
 * converti en abonnement payant.
 */
function trialStatusFor(data: PlatformData, owner: string) {
  const none = { status: "none" as const, daysLeft: 0, endDate: "", planName: "" };
  const client = data.clients.find((c) => c.ownerId === owner);
  if (!client) return none;
  // Un abonnement payant actif signifie que l'essai a été converti.
  const paid = data.subscriptions.find(
    (s) => s.clientId === client.id && effectiveSubscriptionStatus(s) === "active" && s.amount > 0,
  );
  if (paid) {
    const plan = data.plans.find((p) => p.id === paid.planId);
    return { status: "converted" as const, daysLeft: Math.max(0, daysUntil(paid.endDate)), endDate: paid.endDate, planName: plan?.name ?? "" };
  }
  const trial = data.subscriptions.find((s) => s.clientId === client.id && s.planId === "plan-trial")
    ?? data.subscriptions.find((s) => s.clientId === client.id && s.amount === 0);
  if (!trial) return none;
  const plan = data.plans.find((p) => p.id === trial.planId);
  const planName = plan?.name ?? "Essai gratuit";
  if (effectiveSubscriptionStatus(trial) === "expired" || trial.status !== "active") {
    // Essai expiré, ou annulé (remplacé ou retiré) sans abonnement payant : essai consommé.
    return { status: "expired" as const, daysLeft: 0, endDate: trial.endDate, planName };
  }
  return { status: "active" as const, daysLeft: Math.max(0, daysUntil(trial.endDate)), endDate: trial.endDate, planName };
}

router.get("/platform/trial/status", handler(async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Connectez-vous pour voir votre essai gratuit." }); return; }
  const result = await withPlatform(false, (data) =>
    GetPlatformTrialStatusResponse.parse(trialStatusFor(data, `user:${userId}`)));
  res.json(result);
}));

router.post("/platform/trial/start", handler(async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Connectez-vous pour démarrer votre essai gratuit." }); return; }
  const parsed = StartPlatformTrialBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const owner = `user:${userId}`;
  const result = await withPlatform(true, (data) => {
    // Un seul essai par clinique, non renouvelable par elle-même.
    const existing = data.clients.find((c) => c.ownerId === owner);
    if (existing) {
      fail("Votre clinique a déjà une fiche sur la plateforme (essai ou abonnement). Un seul essai gratuit par clinique : contactez ORIONEXA pour passer à un abonnement payant.", 409);
    }
    const trialPlan = data.plans.find((p) => p.id === "plan-trial" && p.active);
    if (!trialPlan) {
      fail("L'essai gratuit n'est pas disponible pour le moment. Contactez ORIONEXA.", 503);
    }
    // Parrainage : le paramètre ref= désigne un commercial existant et actif.
    // Un ref inconnu ou inactif est simplement ignoré (source web).
    const ref = (parsed.data.ref ?? "").trim();
    const salesperson = ref ? data.salespeople.find((s) => s.id === ref && s.active) : undefined;
    const start = today();
    const endDate = addMonths(start, 1);
    const client: PlatformClient = {
      id: id(),
      clinicName: parsed.data.clinicName.trim(),
      contactName: parsed.data.contactName.trim(),
      email: (parsed.data.email ?? "").trim(),
      phone: parsed.data.phone.trim(),
      status: "trial",
      source: salesperson ? "commercial" : "web",
      commercialId: salesperson ? salesperson.id : "",
      ownerId: owner,
      planId: trialPlan.id,
      planAmount: 0,
      createdAt: now(),
      lastLoginAt: "",
    };
    data.clients.unshift(client);
    data.subscriptions.unshift({
      id: id(), clientId: client.id, planId: trialPlan.id, startDate: start,
      durationMonths: 1, endDate, status: "active", amount: 0, commission: 0,
    });
    platformAudit(data, userId, "trial.start", "client", client.id, `Essai gratuit démarré — ${client.clinicName} (30 jours)`);
    return StartPlatformTrialResponse.parse({
      status: "active" as const,
      daysLeft: Math.max(0, daysUntil(endDate)),
      endDate,
      planName: trialPlan.name,
    });
  });
  res.status(201).json(result);
}));

router.use("/platform", requireAdmin);

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof DomainError) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
  };
}

// ---------- Tableau de bord ----------
router.get("/platform/dashboard", handler(async (_req, res) => {
  const result = await withPlatform(false, (data) => {
    const activeSubs = data.subscriptions.filter((s) => effectiveSubscriptionStatus(s) === "active");
    // MRR = somme des montants mensuels des abonnements actifs (montant total / durée).
    const mrr = activeSubs.reduce((sum, s) => sum + Math.round(s.amount / Math.max(1, s.durationMonths)), 0);
    const confirmed = data.sales.filter((s) => s.status === "confirmée");
    const recentClients = [...data.clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
    return GetPlatformDashboardResponse.parse({
      clientsTotal: data.clients.length,
      clientsTrial: data.clients.filter((c) => c.status === "trial").length,
      clientsActive: data.clients.filter((c) => c.status === "active").length,
      mrr,
      revenueTotal: confirmed.reduce((sum, s) => sum + s.amount, 0),
      commissionsTotal: confirmed.reduce((sum, s) => sum + s.commission, 0),
      salespeopleCount: data.salespeople.filter((s) => s.active).length,
      recentClients,
    });
  });
  res.json(result);
}));

// ---------- Cliniques clientes ----------
router.get("/platform/clients", handler(async (_req, res) => {
  const result = await withPlatform(false, (data) => GetPlatformClientsResponse.parse(data.clients));
  res.json(result);
}));

router.post("/platform/clients", handler(async (req, res) => {
  const parsed = CreatePlatformClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const client = {
      ...parsed.data, id: id(), status: "trial" as const,
      planId: "", planAmount: 0, createdAt: now(), lastLoginAt: "",
    };
    data.clients.unshift(client);
    // Essai gratuit de 30 jours : un abonnement d'essai est créé
    // automatiquement (plan à 0 FCFA s'il existe).
    const trialPlan = data.plans.find((p) => p.active && p.priceMonthly === 0) ?? null;
    if (trialPlan) {
      const start = today();
      data.subscriptions.unshift({
        id: id(), clientId: client.id, planId: trialPlan.id, startDate: start,
        durationMonths: 1, endDate: addMonths(start, 1), status: "active", amount: 0, commission: 0,
      });
      client.planId = trialPlan.id;
    }
    platformAudit(data, actorId(req), "client.create", "client", client.id, `Clinique ${client.clinicName} inscrite (essai)`);
    return CreatePlatformClientResponse.parse(client);
  });
  res.status(201).json(result);
}));

router.put("/platform/clients/:id", handler(async (req, res) => {
  const params = UpdatePlatformClientParams.safeParse(req.params);
  const parsed = UpdatePlatformClientBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const client = data.clients.find((c) => c.id === params.data.id);
    if (!client) fail("Clinique introuvable.", 404);
    // Liste blanche : seuls les champs du schéma sont repris (jamais req.body étalé).
    Object.assign(client, parsed.data);
    platformAudit(data, actorId(req), "client.update", "client", client.id, `Clinique ${client.clinicName} mise à jour`);
    return UpdatePlatformClientResponse.parse(client);
  });
  res.json(result);
}));

router.delete("/platform/clients/:id", handler(async (req, res) => {
  const params = DeletePlatformClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Identifiant invalide." }); return; }
  const result = await withPlatform(true, (data) => {
    const idx = data.clients.findIndex((c) => c.id === params.data.id);
    if (idx < 0) fail("Clinique introuvable.", 404);
    const [client] = data.clients.splice(idx, 1);
    // Les abonnements de la clinique partent avec elle ; les ventes sont
    // conservées (historique comptable) et affichées « Client supprimé ».
    data.subscriptions = data.subscriptions.filter((s) => s.clientId !== client.id);
    platformAudit(data, actorId(req), "client.delete", "client", client.id, `Clinique ${client.clinicName} supprimée`);
    return DeletePlatformClientResponse.parse({ ok: true });
  });
  res.json(result);
}));

// ---------- Commerciaux ----------
router.get("/platform/salespeople", handler(async (_req, res) => {
  const result = await withPlatform(false, (data) => GetPlatformSalespeopleResponse.parse(data.salespeople));
  res.json(result);
}));

router.post("/platform/salespeople", handler(async (req, res) => {
  const parsed = CreatePlatformSalespersonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const sp = { ...parsed.data, id: id() };
    data.salespeople.unshift(sp);
    platformAudit(data, actorId(req), "salesperson.create", "salesperson", sp.id, `Commercial ${sp.firstName} ${sp.lastName} créé`);
    return CreatePlatformSalespersonResponse.parse(sp);
  });
  res.status(201).json(result);
}));

router.put("/platform/salespeople/:id", handler(async (req, res) => {
  const params = UpdatePlatformSalespersonParams.safeParse(req.params);
  const parsed = UpdatePlatformSalespersonBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const sp = data.salespeople.find((s) => s.id === params.data.id);
    if (!sp) fail("Commercial introuvable.", 404);
    Object.assign(sp, parsed.data);
    platformAudit(data, actorId(req), "salesperson.update", "salesperson", sp.id, `Commercial ${sp.firstName} ${sp.lastName} mis à jour`);
    return UpdatePlatformSalespersonResponse.parse(sp);
  });
  res.json(result);
}));

router.delete("/platform/salespeople/:id", handler(async (req, res) => {
  const params = DeletePlatformSalespersonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Identifiant invalide." }); return; }
  const result = await withPlatform(true, (data) => {
    const idx = data.salespeople.findIndex((s) => s.id === params.data.id);
    if (idx < 0) fail("Commercial introuvable.", 404);
    const [sp] = data.salespeople.splice(idx, 1);
    // Les ventes passées sont conservées ; le commercial s'affiche « Commercial supprimé ».
    platformAudit(data, actorId(req), "salesperson.delete", "salesperson", sp.id, `Commercial ${sp.firstName} ${sp.lastName} supprimé`);
    return DeletePlatformSalespersonResponse.parse({ ok: true });
  });
  res.json(result);
}));

// ---------- Plans tarifaires ----------
router.get("/platform/plans", handler(async (_req, res) => {
  const result = await withPlatform(false, (data) => GetPlatformPlansResponse.parse(data.plans));
  res.json(result);
}));

router.post("/platform/plans", handler(async (req, res) => {
  const parsed = CreatePlatformPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const plan = { ...parsed.data, id: id() };
    data.plans.push(plan);
    platformAudit(data, actorId(req), "plan.create", "plan", plan.id, `Plan ${plan.name} créé — ${plan.priceMonthly.toLocaleString("fr-FR")} FCFA/mois`);
    return CreatePlatformPlanResponse.parse(plan);
  });
  res.status(201).json(result);
}));

router.put("/platform/plans/:id", handler(async (req, res) => {
  const params = UpdatePlatformPlanParams.safeParse(req.params);
  const parsed = UpdatePlatformPlanBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const plan = data.plans.find((p) => p.id === params.data.id);
    if (!plan) fail("Plan introuvable.", 404);
    Object.assign(plan, parsed.data);
    platformAudit(data, actorId(req), "plan.update", "plan", plan.id, `Plan ${plan.name} mis à jour`);
    return UpdatePlatformPlanResponse.parse(plan);
  });
  res.json(result);
}));

router.delete("/platform/plans/:id", handler(async (req, res) => {
  const params = DeletePlatformPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Identifiant invalide." }); return; }
  const result = await withPlatform(true, (data) => {
    const plan = data.plans.find((p) => p.id === params.data.id);
    if (!plan) fail("Plan introuvable.", 404);
    if (data.subscriptions.some((s) => s.planId === plan.id && effectiveSubscriptionStatus(s) === "active")) {
      fail("Ce plan est utilisé par un abonnement actif.", 409);
    }
    data.plans = data.plans.filter((p) => p.id !== plan.id);
    platformAudit(data, actorId(req), "plan.delete", "plan", plan.id, `Plan ${plan.name} supprimé`);
    return DeletePlatformPlanResponse.parse({ ok: true });
  });
  res.json(result);
}));

// ---------- Abonnements ----------
router.get("/platform/subscriptions", handler(async (_req, res) => {
  const result = await withPlatform(false, (data) => GetPlatformSubscriptionsResponse.parse(data.subscriptions));
  res.json(result);
}));

router.post("/platform/subscriptions", handler(async (req, res) => {
  const parsed = CreatePlatformSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Vérifiez les champs obligatoires." }); return; }
  const result = await withPlatform(true, (data) => {
    const { clientId, planId, startDate, durationMonths } = parsed.data;
    const client = data.clients.find((c) => c.id === clientId);
    if (!client) fail("Clinique introuvable : créez d'abord la clinique cliente.", 400);
    const plan = data.plans.find((p) => p.id === planId);
    if (!plan) fail("Plan introuvable.", 404);
    if (!plan.active) fail("Ce plan n'est plus actif.", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) fail("La date de début est invalide.");
    // Un abonnement payant actif existe déjà : annulez-le avant d'en créer un autre.
    const existingPaid = data.subscriptions.find(
      (s) => s.clientId === clientId && effectiveSubscriptionStatus(s) === "active" && s.amount > 0,
    );
    if (existingPaid) fail("Un abonnement payant actif existe déjà pour cette clinique.", 409);
    // L'essai en cours est remplacé par l'abonnement payant.
    for (const s of data.subscriptions) {
      if (s.clientId === clientId && effectiveSubscriptionStatus(s) === "active" && s.amount === 0) s.status = "cancelled";
    }
    const amount = plan.priceMonthly * durationMonths;
    const salesperson = client.commercialId ? data.salespeople.find((s) => s.id === client.commercialId) : undefined;
    const rate = salesperson ? salesperson.commissionRate : 0;
    const commission = Math.round(amount * (rate / 100));
    const subscription = {
      id: id(), clientId, planId, startDate, durationMonths,
      endDate: addMonths(startDate, durationMonths), status: "active" as const,
      amount, commission,
    };
    data.subscriptions.unshift(subscription);
    // Vente confirmée automatique (comme dans ComptaOrion) : la commission
    // est de 0 si aucun commercial n'est assigné à la clinique.
    data.sales.unshift({
      id: id(), clientId, commercialId: client.commercialId,
      source: client.commercialId ? "commercial" as const : client.source === "partner" ? "partner" as const : "web" as const,
      amount, commission, status: "confirmée",
      createdAt: now(), label: `Abonnement ${plan.name} — ${durationMonths} mois`,
    });
    client.status = "active";
    client.planId = plan.id;
    client.planAmount = plan.priceMonthly;
    platformAudit(data, actorId(req), "subscription.create", "subscription", subscription.id, `Abonnement ${plan.name} — ${client.clinicName} (${amount.toLocaleString("fr-FR")} FCFA)`);
    return CreatePlatformSubscriptionResponse.parse(subscription);
  });
  res.status(201).json(result);
}));

router.post("/platform/subscriptions/:id/cancel", handler(async (req, res) => {
  const params = CancelPlatformSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Identifiant invalide." }); return; }
  const result = await withPlatform(true, (data) => {
    const sub = data.subscriptions.find((s) => s.id === params.data.id);
    if (!sub) fail("Abonnement introuvable.", 404);
    if (sub.status !== "active") fail("Cet abonnement n'est pas actif.", 400);
    sub.status = "cancelled";
    const client = data.clients.find((c) => c.id === sub.clientId);
    if (client && !data.subscriptions.some((s) => s.clientId === client.id && effectiveSubscriptionStatus(s) === "active")) {
      client.status = "inactive";
    }
    platformAudit(data, actorId(req), "subscription.cancel", "subscription", sub.id, `Abonnement annulé — ${client?.clinicName ?? sub.clientId}`);
    return CreatePlatformSubscriptionResponse.parse(sub);
  });
  res.json(result);
}));

// ---------- Ventes ----------
router.get("/platform/sales", handler(async (req, res) => {
  const source = typeof req.query.source === "string" ? req.query.source : "";
  const result = await withPlatform(false, (data) => {
    const sales = source && source !== "all"
      ? data.sales.filter((s) => s.source === source)
      : data.sales;
    return GetPlatformSalesResponse.parse(sales);
  });
  res.json(result);
}));

export default router;
