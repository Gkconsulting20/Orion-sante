import { useState, type FormEvent } from "react";
import { Check, Clock, Gift, Loader2 } from "lucide-react";
import type { TrialStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/kit";
import { errMsg, fDate } from "@/lib/fmt";
import { useRefreshTrial, useStartTrial } from "@/hooks/use-clinic";
import { clearTrialRef, readTrialRef } from "@/lib/trial-ref";

/** Libellé des jours restants d'un essai actif. */
function daysLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Dernier jour de votre essai";
  if (daysLeft === 1) return "1 jour restant";
  return `${daysLeft} jours restants`;
}

/** Bandeau affiché pendant l'essai gratuit actif. */
export function TrialBanner({ status }: { status: TrialStatus }) {
  return (
    <div className="panel p-5 mb-6 rise flex gap-4 items-start border-l-4 !border-l-saffron" data-testid="trial-banner">
      <Gift className="size-5 text-saffron shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">Votre essai gratuit est actif — {daysLabel(status.daysLeft)}</div>
        <p className="text-sm text-muted-foreground mt-1">
          Essai gratuit jusqu'au {fDate(status.endDate)}. Vous avez accès à toutes les fonctionnalités
          d'Orion Santé. À la fin de l'essai, contactez ORIONEXA pour passer à un abonnement payant
          et garder l'accès à votre clinique — les 2 premiers mois de l'abonnement sont gratuits.
        </p>
      </div>
    </div>
  );
}

/** Carte de démarrage de l'essai gratuit (clinique connectée sans fiche plateforme). */
export function TrialStartCard({ defaultClinicName }: { defaultClinicName: string }) {
  const start = useStartTrial();
  const refreshTrial = useRefreshTrial();
  const [f, setF] = useState({ clinicName: defaultClinicName, contactName: "", phone: "", email: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState<TrialStatus | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.clinicName.trim()) return setErr("Le nom de la clinique est obligatoire.");
    if (!f.contactName.trim()) return setErr("Votre nom est obligatoire.");
    if (!f.phone.trim()) return setErr("Le numéro de téléphone est obligatoire.");
    try {
      const result = await start.mutateAsync({
        data: {
          clinicName: f.clinicName.trim(),
          contactName: f.contactName.trim(),
          phone: f.phone.trim(),
          email: f.email.trim() || undefined,
          ref: readTrialRef() || undefined,
        },
      });
      clearTrialRef();
      setDone(result);
      await refreshTrial();
    } catch (error) {
      setErr(errMsg(error));
    }
  }

  if (done) {
    return (
      <div className="panel p-6 mb-6 rise" data-testid="trial-confirmation">
        <div className="flex gap-3 items-start">
          <span className="size-9 rounded-full bg-lagoon/15 text-lagoon flex items-center justify-center shrink-0">
            <Check className="size-5" />
          </span>
          <div>
            <div className="font-semibold">Votre essai gratuit est démarré !</div>
            <p className="text-sm text-muted-foreground mt-1">
              Vous pouvez utiliser Orion Santé gratuitement jusqu'au {fDate(done.endDate)}.
              À la fin de l'essai, contactez ORIONEXA pour passer à un abonnement payant et garder
              l'accès à votre clinique — les 2 premiers mois de l'abonnement sont gratuits.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="panel p-6 mb-6 rise" data-testid="trial-start-card">
      <div className="flex gap-3 items-start">
        <span className="size-9 rounded-full bg-saffron/15 text-saffron flex items-center justify-center shrink-0">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base">Essayez Orion Santé gratuitement pendant 30 jours</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Accès complet à toutes les fonctionnalités : dossiers patients, consultations, rendez-vous,
            facturation, caisse et rapports. Aucun paiement demandé. Un seul essai gratuit par clinique ;
            à la fin de l'essai, contactez ORIONEXA pour passer à un abonnement payant — les 2 premiers
            mois de l'abonnement sont gratuits.
          </p>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 mt-4">
            <Field label="Nom de la clinique">
              <input className="field" value={f.clinicName} maxLength={150} onChange={(e) => setF({ ...f, clinicName: e.target.value })} data-testid="input-trial-clinic" />
            </Field>
            <Field label="Votre nom (contact)">
              <input className="field" value={f.contactName} maxLength={150} placeholder="Ex. Afi Mensah" onChange={(e) => setF({ ...f, contactName: e.target.value })} data-testid="input-trial-contact" />
            </Field>
            <Field label="Téléphone">
              <input className="field" value={f.phone} maxLength={30} placeholder="+228 90 00 00 00" onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="input-trial-phone" />
            </Field>
            <Field label="E-mail (facultatif)">
              <input className="field" type="email" value={f.email} maxLength={150} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="input-trial-email" />
            </Field>
            {err && <p className="text-sm text-destructive sm:col-span-2" data-testid="trial-error">{err}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={start.isPending} data-testid="button-start-trial">
                {start.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Clock className="size-4 mr-2" />}
                Démarrer mon essai gratuit de 30 jours
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

/** Panneau affiché quand l'essai est expiré et que l'accès est bloqué (API 403). */
export function TrialExpiredPanel() {
  return (
    <div>
      <div className="panel p-8 flex flex-col items-center text-center" data-testid="trial-expired">
        <Clock className="size-6 text-destructive mb-3" />
        <div className="font-display font-semibold">Votre essai gratuit est terminé</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Votre accès à la clinique est bloqué. Écrivez à contact@orionexa.com pour passer à un
          abonnement payant et retrouver l'accès à votre clinique — les 2 premiers mois de
          l'abonnement sont gratuits.
        </p>
      </div>
    </div>
  );
}
