/**
 * Parrainage de l'essai gratuit : le paramètre `ref=` désigne un commercial
 * (lien partagé : /sign-up?ref=<id du commercial>).
 *
 * Le paramètre est capté dès l'arrivée sur le site (avant l'inscription
 * Clerk, qui fait perdre la chaîne de requête) et conservé dans la session
 * du navigateur : après la création du compte, le tableau de bord le
 * retrouve pour attribuer l'essai au commercial. Il est effacé une fois
 * l'essai démarré. Le paramètre présent dans l'URL prime toujours.
 */
const KEY = "orion_trial_ref";

/** Mémorise le `ref=` présent dans l'URL, s'il y en a un. */
export function captureTrialRef(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim();
    if (ref) window.sessionStorage.setItem(KEY, ref);
  } catch {
    // Stockage indisponible : on ignore, l'attribution ne se fera pas.
  }
}

/** Le `ref=` de l'URL, sinon celui mémorisé pendant l'inscription. */
export function readTrialRef(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref")?.trim();
    if (fromUrl) return fromUrl;
    return window.sessionStorage.getItem(KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Efface le `ref=` mémorisé (après le démarrage de l'essai). */
export function clearTrialRef(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
