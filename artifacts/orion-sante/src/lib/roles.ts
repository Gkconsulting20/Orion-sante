import type { ClinicRole } from "@workspace/api-client-react";

export type { ClinicRole };

export const ROLE_LABELS: Record<ClinicRole, string> = {
  owner: "Propriétaire",
  doctor: "Médecin",
  secretary: "Secrétaire",
  accountant: "Comptable",
};

export type ClinicModule =
  | "patients"
  | "consultations"
  | "rendez-vous"
  | "facturation"
  | "caisse"
  | "rapports"
  | "parametres"
  | "journal";

/**
 * Miroir frontend de la matrice définie dans `lib/api-zod/src/roles.ts`.
 * L'API reste la seule autorité (refus 403) ; ce miroir ne sert qu'à
 * masquer/désactiver les actions dans l'interface. En cas de divergence,
 * l'API a raison — mettre les deux fichiers à jour ensemble.
 */
const PERMISSIONS: Record<ClinicRole, Record<ClinicModule, { read: boolean; write: boolean }>> = {
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
  if (!role || !(role in PERMISSIONS)) return true;
  return PERMISSIONS[role as ClinicRole][module][action];
}

/** Les antécédents et allergies sont réservés au médecin (et au propriétaire). */
export function canSeeClinical(role: string | null | undefined): boolean {
  return !role || role === "owner" || role === "doctor";
}

/** Rôle de l'utilisateur courant (la démo renvoie "owner"). */
export function roleOf(ws: { role?: string | null } | null | undefined): ClinicRole {
  const r = ws?.role;
  if (r === "doctor" || r === "secretary" || r === "accountant") return r;
  return "owner";
}

export function can(ws: { role?: string | null } | null | undefined, module: ClinicModule, action: "read" | "write"): boolean {
  return canRole(roleOf(ws), module, action);
}

/** Masque un numéro de téléphone : +228 90 •• •• •• (indicatif + 2 premiers chiffres visibles). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "—";
  const m = digits.match(/^(\+\d{1,3})(\d{2})(\d+)$/);
  if (!m) return `${digits.slice(0, 4)} •• •• ••`;
  const rest = m[3]!;
  const groups = rest.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return `${m[1]} ${m[2]} ${groups.replace(/\d/g, "•")}`;
}
