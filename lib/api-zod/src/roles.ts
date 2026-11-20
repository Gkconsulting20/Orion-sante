/**
 * Rôles et permissions d'une clinique — source unique, partagée entre
 * l'API (refus 403 des écritures) et le frontend (masquage des actions).
 *
 * Les droits se décident PAR RÔLE, jamais par le nom d'un plan ou d'un
 * abonnement : un plan ne donne que des limites (utilisateurs, patients,
 * stockage), pas des permissions.
 */
import type { ClinicRole } from "./generated/types";

export type { ClinicRole };

export const ROLE_LABELS: Record<ClinicRole, string> = {
  owner: "Propriétaire",
  doctor: "Médecin",
  secretary: "Secrétaire",
  accountant: "Comptable",
};

export const CLINIC_ROLES: ClinicRole[] = ["owner", "doctor", "secretary", "accountant"];

export function isClinicRole(value: unknown): value is ClinicRole {
  return typeof value === "string" && (CLINIC_ROLES as string[]).includes(value);
}

export type ClinicModule =
  | "patients"
  | "consultations"
  | "rendez-vous"
  | "facturation"
  | "caisse"
  | "rapports"
  | "parametres"
  | "journal";

export const CLINIC_MODULES: { id: ClinicModule; label: string }[] = [
  { id: "patients", label: "Patients" },
  { id: "consultations", label: "Consultations" },
  { id: "rendez-vous", label: "Rendez-vous" },
  { id: "facturation", label: "Facturation" },
  { id: "caisse", label: "Caisse" },
  { id: "rapports", label: "Rapports" },
  { id: "parametres", label: "Paramètres" },
  { id: "journal", label: "Journal d'activité" },
];

type Access = { read: boolean; write: boolean };

/**
 * Matrice des permissions. Lecture seule partout par défaut pour les rôles
 * non propriétaires ; l'écriture est limitée au périmètre métier de chacun.
 * Seul le Propriétaire gère les paramètres, les membres et les suppressions.
 */
export const PERMISSIONS: Record<ClinicRole, Record<ClinicModule, Access>> = {
  owner: {
    patients: { read: true, write: true },
    consultations: { read: true, write: true },
    "rendez-vous": { read: true, write: true },
    facturation: { read: true, write: true },
    caisse: { read: true, write: true },
    rapports: { read: true, write: true },
    parametres: { read: true, write: true },
    journal: { read: true, write: true },
  },
  doctor: {
    patients: { read: true, write: true },
    consultations: { read: true, write: true },
    "rendez-vous": { read: true, write: true },
    facturation: { read: true, write: false },
    caisse: { read: true, write: false },
    rapports: { read: true, write: false },
    parametres: { read: true, write: false },
    journal: { read: true, write: false },
  },
  secretary: {
    patients: { read: true, write: true },
    consultations: { read: true, write: true },
    "rendez-vous": { read: true, write: true },
    facturation: { read: true, write: true },
    caisse: { read: true, write: false },
    rapports: { read: true, write: false },
    parametres: { read: true, write: false },
    journal: { read: true, write: false },
  },
  accountant: {
    patients: { read: true, write: false },
    consultations: { read: true, write: false },
    "rendez-vous": { read: true, write: false },
    facturation: { read: true, write: true },
    caisse: { read: true, write: true },
    rapports: { read: true, write: false },
    parametres: { read: true, write: false },
    journal: { read: true, write: false },
  },
};

export function canRole(
  role: string | null | undefined,
  module: ClinicModule,
  action: "read" | "write",
): boolean {
  // Rôle inconnu ou absent : le propriétaire de la clinique (comportement
  // historique — une clinique créée par connexion directe n'a pas encore de
  // membre enregistré).
  if (!role || !isClinicRole(role)) return true;
  return PERMISSIONS[role][module][action];
}

/** Les antécédents et allergies sont réservés au médecin (et au propriétaire). */
export function canSeeClinical(role: string | null | undefined): boolean {
  return !role || role === "owner" || role === "doctor";
}
