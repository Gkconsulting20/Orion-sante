import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2, Loader2, Save, ShieldCheck, Users, ScrollText } from "lucide-react";
import { useUpdateSettings, type Settings, type Service } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefresh, useWorkspace } from "@/hooks/use-clinic";
import { ErrorState, Field, PageHeader, PageSkeleton } from "@/components/kit";
import { errMsg, intOnly } from "@/lib/fmt";
import { can } from "@/lib/roles";

type SvcDraft = { id: string; name: string; price: string };

export default function Parametres() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const update = useUpdateSettings();
  const refresh = useRefresh();
  const { toast } = useToast();
  const [f, setF] = useState<Omit<Settings, "services" | "practitioners"> | null>(null);
  const [svcs, setSvcs] = useState<SvcDraft[]>([]);
  const [pracs, setPracs] = useState<string[]>([]);
  const [newPrac, setNewPrac] = useState("");
  const [err, setErr] = useState("");
  const inited = useRef(false);

  useEffect(() => {
    if (ws && !inited.current) {
      inited.current = true;
      const s = ws.settings;
      setF({ clinicName: s.clinicName, address: s.address, phone: s.phone, email: s.email, receiptFooter: s.receiptFooter });
      setSvcs(s.services.map((x) => ({ id: x.id, name: x.name, price: String(x.price) })));
      setPracs(s.practitioners);
    }
  }, [ws]);

  if (isLoading || (ws && !f)) return <PageSkeleton />;
  if (error || !ws || !f) return <ErrorState error={error} onRetry={() => refetch()} />;

  async function save() {
    if (!f) return;
    setErr("");
    if (!f.clinicName.trim()) return setErr("Le nom de la clinique est obligatoire.");
    const services: Service[] = [];
    for (const s of svcs) {
      if (!s.name.trim()) return setErr("Chaque prestation doit avoir un nom.");
      services.push({ id: s.id, name: s.name.trim(), price: Math.max(0, intOnly(s.price)) });
    }
    try {
      await update.mutateAsync({ data: { ...f, clinicName: f.clinicName.trim(), services, practitioners: pracs.map((p) => p.trim()).filter(Boolean) } });
      await refresh();
      toast({ title: "Paramètres enregistrés" });
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const canWrite = can(ws, "parametres", "write");

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Paramètres de la clinique" sub="Ces informations apparaissent sur les reçus, factures et ordonnances imprimés."
        actions={<Button onClick={save} disabled={update.isPending || !canWrite} data-testid="button-save-settings">{update.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Enregistrer</Button>} />
      {err && <div className="mb-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2" data-testid="text-settings-error">{err}</div>}
      {!canWrite && <div className="mb-3 text-sm rounded-lg bg-secondary px-3 py-2 text-muted-foreground">La modification des paramètres est réservée au propriétaire de la clinique.</div>}

      <div className="grid lg:grid-cols-2 gap-3">
        <section className="panel p-5 space-y-3 rise">
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="size-4" /> Protection des données</h3>
          <p className="text-sm text-muted-foreground">Journal d'activité, utilisateurs et rôles, consentement des patients.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/journal" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary" data-testid="link-journal"><ScrollText className="size-4" /> Journal d'activité</Link>
            <Link href="/utilisateurs" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary" data-testid="link-utilisateurs"><Users className="size-4" /> Utilisateurs et accès</Link>
          </div>
          <p className="text-[11px] text-muted-foreground">Le journal enregistre qui a fait quoi (création de dossier, consultation, règlement, export, suppression, caisse) — sans jamais contenir de données médicales.</p>
        </section>
        <section className="panel p-5 space-y-3 rise">
          <h3 className="font-semibold">Identité</h3>
          <Field label="Nom de la clinique"><input className="field" maxLength={150} value={f.clinicName} onChange={(e) => set("clinicName", e.target.value)} data-testid="input-clinic-name" /></Field>
          <Field label="Adresse"><input className="field" maxLength={300} value={f.address} onChange={(e) => set("address", e.target.value)} data-testid="input-clinic-address" /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Téléphone"><input className="field" maxLength={30} value={f.phone} onChange={(e) => set("phone", e.target.value)} data-testid="input-clinic-phone" /></Field>
            <Field label="E-mail"><input className="field" type="email" maxLength={150} value={f.email} onChange={(e) => set("email", e.target.value)} data-testid="input-clinic-email" /></Field>
          </div>
          <Field label="Pied de page des reçus"><textarea className="field" maxLength={500} value={f.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} data-testid="input-receipt-footer" /></Field>
        </section>

        <section className="panel p-5 rise">
          <h3 className="font-semibold mb-3">Praticiens</h3>
          <ul className="space-y-1.5 mb-3">
            {pracs.length === 0 && <li className="text-sm text-muted-foreground">Aucun praticien. Ajoutez les noms utilisés dans les consultations.</li>}
            {pracs.map((p, i) => (
              <li key={i} className="flex gap-2">
                <input className="field h-9" value={p} maxLength={100} onChange={(e) => setPracs(pracs.map((x, j) => (j === i ? e.target.value : x)))} data-testid={`input-practitioner-${i}`} />
                <button className="size-9 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setPracs(pracs.filter((_, j) => j !== i))} aria-label="Retirer" data-testid={`button-remove-practitioner-${i}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newPrac.trim()) { setPracs([...pracs, newPrac.trim()]); setNewPrac(""); } }}>
            <input className="field h-9" placeholder="Dr Afi Mensah" value={newPrac} maxLength={100} onChange={(e) => setNewPrac(e.target.value)} data-testid="input-new-practitioner" />
            <Button type="submit" size="sm" variant="outline" className="h-9" data-testid="button-add-practitioner"><Plus className="size-4" /></Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-3">Liste de noms pour les consultations et ordonnances. Les comptes d'équipe se gèrent dans « Utilisateurs et accès ».</p>
        </section>

        <section className="panel p-5 lg:col-span-2 rise">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Tarifs des prestations</h3>
            <Button size="sm" variant="outline" onClick={() => setSvcs([...svcs, { id: crypto.randomUUID(), name: "", price: "0" }])} data-testid="button-add-service"><Plus className="size-4 mr-1" /> Prestation</Button>
          </div>
          <div className="grid grid-cols-[1fr_160px_40px] gap-2 label-s px-1 mb-1"><span>Prestation</span><span className="text-right">Prix FCFA</span><span /></div>
          <ul className="space-y-1.5">
            {svcs.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[1fr_160px_40px] gap-2">
                <input className="field h-9" value={s.name} onChange={(e) => setSvcs(svcs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`input-service-name-${i}`} />
                <input className="field h-9 num text-right" inputMode="numeric" value={s.price} onChange={(e) => setSvcs(svcs.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d]/g, "") } : x)))} data-testid={`input-service-price-${i}`} />
                <button className="size-9 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setSvcs(svcs.filter((_, j) => j !== i))} aria-label="Retirer" data-testid={`button-remove-service-${i}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
            {svcs.length === 0 && <li className="text-sm text-muted-foreground">Aucune prestation tarifée.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
