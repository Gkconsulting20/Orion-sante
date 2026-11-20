import {
  type AuditLogEntry,
  type PlatformClient,
  type PlatformPlan,
  type PlatformSale,
  type PlatformSalesperson,
  type PlatformSubscription,
} from "@workspace/api-zod";
import { day, id, now, today } from "./clinic-data";

/** Ligne spéciale de la table `clinics` qui porte les données SaaS de la plateforme. */
export const PLATFORM_OWNER = "platform:orionexa";

/**
 * Offre commerciale (décision ORIONEXA, 20 nov. 2026) : chaque NOUVEL
 * abonnement payant inclut 2 mois gratuits. L'essai gratuit reste à
 * 30 jours et n'est pas concerné. Les 2 mois gratuits font partie de la
 * durée de l'abonnement : le client paie prix × (durée − 2), la facturation
 * commence au 3e mois. La commission du commercial n'est due que quand le
 * client paie, donc à partir de la date de début de facturation.
 */
export const FREE_MONTHS_ON_SUBSCRIPTION = 2;

/**
 * Agrégat commercial de la plateforme ORIONEXA. Il vit dans la même table
 * `clinics` que les cliniques (aucune migration possible) : une seule ligne,
 * propriétaire `platform:orionexa`. Aucune donnée de patient ici.
 */
export interface PlatformData {
  plans: PlatformPlan[];
  clients: PlatformClient[];
  salespeople: PlatformSalesperson[];
  subscriptions: PlatformSubscription[];
  sales: PlatformSale[];
  auditLog: AuditLogEntry[];
}

export function platformAudit(
  data: PlatformData,
  actorId: string,
  action: string,
  entity: string,
  recordId: string,
  detail: string,
) {
  const entry: AuditLogEntry = {
    id: id(), createdAt: now(), actorId, actorLabel: "Administration ORIONEXA",
    action, entity, recordId, detail,
  };
  data.auditLog.unshift(entry);
  data.auditLog = data.auditLog.slice(0, 200);
}

/** Ajoute `months` mois à une date AAAA-MM-JJ (mois calendaires). */
export function addMonths(dateKey: string, months: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return day(d.toISOString());
}

/** Nombre de jours entiers entre aujourd'hui (UTC) et une date AAAA-MM-JJ (peut être négatif). */
export function daysUntil(dateKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/** Statut effectif d'un abonnement : un abonnement actif passé d'échéance est expiré. */
export function effectiveSubscriptionStatus(sub: PlatformSubscription): "active" | "cancelled" | "expired" {
  if (sub.status !== "active") return sub.status;
  return sub.endDate < today() ? "expired" : "active";
}

/**
 * Un abonnement est « payant » si son plan a un prix mensuel > 0 (l'essai
 * est à 0 FCFA). Ne PAS se baser sur le montant : un abonnement payant de
 * 2 mois seulement a un montant de 0 FCFA (2 mois gratuits) mais reste un
 * abonnement payant — sinon il serait confondu avec un essai.
 */
export function isPaidSubscription(data: PlatformData, sub: PlatformSubscription): boolean {
  const plan = data.plans.find((p) => p.id === sub.planId);
  return (plan?.priceMonthly ?? 0) > 0;
}

/** Mois gratuits d'un abonnement (0 pour l'essai et les anciennes lignes sans le champ). */
export function freeMonthsOf(sub: PlatformSubscription): number {
  return sub.freeMonths ?? 0;
}

/** Date de début de facturation = début + mois gratuits (début pour les anciennes lignes). */
export function billingStartDateOf(sub: PlatformSubscription): string {
  return sub.billingStartDate ?? sub.startDate;
}

/** Nombre de mois effectivement payés par le client sur cet abonnement. */
export function paidMonthsOf(sub: PlatformSubscription): number {
  return Math.max(0, sub.durationMonths - freeMonthsOf(sub));
}

/** Plan actif de la clinique (via son abonnement actif), ou null si aucun. */
export function clinicPlan(platform: PlatformData | null, owner: string): PlatformPlan | null {
  if (!platform) return null;
  const client = platform.clients.find((c) => c.ownerId === owner);
  if (!client) return null;
  const sub = platform.subscriptions.find(
    (s) => s.clientId === client.id && effectiveSubscriptionStatus(s) === "active",
  );
  if (!sub) return null;
  return platform.plans.find((p) => p.id === sub.planId && p.active) ?? null;
}

/**
 * Données commerciales fictives de démonstration (code seulement, jamais
 * écrites en base par le seed lui-même : la ligne est créée à la première
 * visite de l'espace Commercialisation). Prix provisoires, modifiables
 * dans l'interface par l'administrateur.
 */
export function initialPlatformData(): PlatformData {
  const createdAt = now();
  const start = today();
  const plans: PlatformPlan[] = [
    { id: "plan-trial", name: "Essai gratuit", priceMonthly: 0, periodMonths: 1, maxUsers: 2, maxPatients: 50, maxStorageGb: 1, features: "30 jours d'essai · 2 utilisateurs · 50 patients · 1 Go", active: true },
    { id: "plan-solo", name: "Solo", priceMonthly: 9900, periodMonths: 1, maxUsers: 3, maxPatients: 200, maxStorageGb: 5, features: "1 praticien · 200 patients · 5 Go", active: true },
    { id: "plan-clinique", name: "Clinique", priceMonthly: 19900, periodMonths: 1, maxUsers: 10, maxPatients: 1000, maxStorageGb: 20, features: "10 utilisateurs · 1 000 patients · 20 Go", active: true },
    { id: "plan-reseau", name: "Réseau", priceMonthly: 39900, periodMonths: 1, maxUsers: 30, maxPatients: 5000, maxStorageGb: 100, features: "30 utilisateurs · 5 000 patients · 100 Go", active: true },
  ];
  const salespeople: PlatformSalesperson[] = [
    { id: "sp-1", firstName: "Kossi", lastName: "Agbeko", email: "kossi.agbeko@example.tg", phone: "+228 90 11 22 33", region: "Maritime", commissionRate: 10, monthlyGoal: 500000, active: true },
  ];
  const clients: PlatformClient[] = [
    { id: "cl-1", clinicName: "Clinique Sainte-Marie (fictif)", contactName: "Afi Mensah", email: "contact@sainte-marie.example.tg", phone: "+228 90 44 55 66", status: "trial", source: "web", commercialId: "", ownerId: "", planId: "plan-trial", planAmount: 0, createdAt, lastLoginAt: "" },
    { id: "cl-2", clinicName: "Clinique Espoir (fictif)", contactName: "Kossi Lawson", email: "contact@espoir.example.tg", phone: "+228 90 77 88 99", status: "active", source: "commercial", commercialId: "sp-1", ownerId: "", planId: "plan-clinique", planAmount: 19900, createdAt, lastLoginAt: "" },
  ];
  const subscriptions: PlatformSubscription[] = [
    { id: "sub-1", clientId: "cl-1", planId: "plan-trial", startDate: start, durationMonths: 1, endDate: addMonths(start, 1), status: "active", amount: 0, commission: 0, freeMonths: 0, billingStartDate: start },
    { id: "sub-2", clientId: "cl-2", planId: "plan-clinique", startDate: start, durationMonths: 12, endDate: addMonths(start, 12), status: "active", amount: 19900 * 10, commission: 19900 * 10 * 0.1, freeMonths: FREE_MONTHS_ON_SUBSCRIPTION, billingStartDate: addMonths(start, FREE_MONTHS_ON_SUBSCRIPTION) },
  ];
  const sales: PlatformSale[] = [
    { id: "sale-1", clientId: "cl-2", commercialId: "sp-1", source: "commercial", amount: 19900 * 10, commission: 19900 * 10 * 0.1, status: "confirmée", createdAt, label: "Abonnement Clinique — 12 mois (2 mois gratuits)", commissionDueDate: addMonths(start, FREE_MONTHS_ON_SUBSCRIPTION) },
  ];
  return {
    plans,
    clients,
    salespeople,
    subscriptions,
    sales,
    auditLog: [
      { id: id(), createdAt, actorId: "admin", actorLabel: "Administration ORIONEXA", action: "client.create", entity: "client", recordId: "cl-2", detail: "Clinique Espoir (fictif) inscrite" },
    ],
  };
}
