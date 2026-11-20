import { useMemo, useState, type FormEvent } from "react";
import { Briefcase, Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import {
  useGetPlatformMe,
  useGetPlatformDashboard,
  useGetPlatformClients,
  useGetPlatformSalespeople,
  useGetPlatformPlans,
  useGetPlatformSubscriptions,
  useGetPlatformSales,
  useCreatePlatformClient,
  useUpdatePlatformClient,
  useDeletePlatformClient,
  useCreatePlatformSalesperson,
  useUpdatePlatformSalesperson,
  useDeletePlatformSalesperson,
  useCreatePlatformPlan,
  useUpdatePlatformPlan,
  useDeletePlatformPlan,
  useCreatePlatformSubscription,
  useCancelPlatformSubscription,
  type PlatformClient,
  type PlatformPlan,
  type PlatformSalesperson,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefreshPlatform } from "@/hooks/use-clinic";
import { Empty, ErrorState, Field, PageHeader, PageSkeleton, Stat, Tabs } from "@/components/kit";
import { errMsg, fDate, fcfa, intOnly, todayKey } from "@/lib/fmt";

const CLIENT_STATUS: Record<string, string> = { trial: "Essai", active: "Actif", suspended: "Suspendu", inactive: "Inactif" };
const SOURCE_LABELS: Record<string, string> = { web: "Web", commercial: "Commercial", partner: "Partenaire" };
const SUB_STATUS: Record<string, string> = { active: "Actif", cancelled: "Annulé", expired: "Expiré" };

function effectiveSubStatus(s: { status: string; endDate: string }): string {
  if (s.status !== "active") return s.status;
  return s.endDate < todayKey() ? "expired" : "active";
}

type Tab = "dashboard" | "clients" | "commerciaux" | "plans" | "abonnements" | "ventes" | "guide";

export default function Commercialisation() {
  const me = useGetPlatformMe({ query: { staleTime: 5 * 60_000, retry: 1 } });
  const [tab, setTab] = useState<Tab>("dashboard");

  if (me.isLoading) return <PageSkeleton />;
  if (me.error || !me.data?.isPlatformAdmin) {
    return (
      <div>
        <PageHeader eyebrow="ORIONEXA" title="Commercialisation" sub="Espace de gestion des ventes SaaS d'Orion Santé." />
        <div className="panel p-6 rise">
          <Empty icon={<Briefcase className="size-5" />} title="Accès réservé" text="Cet espace est réservé à l'administration de la plateforme ORIONEXA. Votre identifiant Clerk doit être déclaré dans la variable ORIONEXA_ADMIN_IDS du Worker." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="ORIONEXA · SaaS" title="Commercialisation" sub="Cliniques clientes, commerciaux, plans, abonnements et ventes — en FCFA." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "dashboard", label: "Tableau de bord" },
            { value: "clients", label: "Cliniques clientes" },
            { value: "commerciaux", label: "Commerciaux" },
            { value: "plans", label: "Plans tarifaires" },
            { value: "abonnements", label: "Abonnements" },
            { value: "ventes", label: "Ventes" },
            { value: "guide", label: "Guide" },
          ]}
        />
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "clients" && <ClientsTab />}
      {tab === "commerciaux" && <SalespeopleTab />}
      {tab === "plans" && <PlansTab />}
      {tab === "abonnements" && <SubscriptionsTab />}
      {tab === "ventes" && <SalesTab />}
      {tab === "guide" && <GuideTab />}
    </div>
  );
}

/* ---------------- Tableau de bord ---------------- */
function DashboardTab() {
  const { data, isLoading, error, refetch } = useGetPlatformDashboard({ query: { staleTime: 15_000, retry: 1 } });
  const clients = useGetPlatformClients({ query: { staleTime: 15_000, retry: 1 } });
  const salespeople = useGetPlatformSalespeople({ query: { staleTime: 15_000, retry: 1 } });
  const plans = useGetPlatformPlans({ query: { staleTime: 15_000, retry: 1 } });
  if (isLoading || clients.isLoading || salespeople.isLoading || plans.isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const spName = (id: string) => {
    const sp = (salespeople.data ?? []).find((s) => s.id === id);
    return sp ? `${sp.firstName} ${sp.lastName}` : "—";
  };
  const planName = (id: string) => (plans.data ?? []).find((p) => p.id === id)?.name ?? "—";
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cliniques clientes" value={String(data.clientsTotal)} hint={`${data.clientsTrial} en essai · ${data.clientsActive} actives`} />
        <Stat label="MRR (revenu mensuel)" value={fcfa(data.mrr)} tone="lagoon" hint="Abonnements actifs" />
        <Stat label="Chiffre d'affaires total" value={fcfa(data.revenueTotal)} hint="Ventes confirmées" />
        <Stat label="Commerciaux" value={String(data.salespeopleCount)} hint={`${fcfa(data.commissionsTotal)} de commissions`} />
      </div>
      <section className="panel overflow-hidden rise">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold">10 dernières cliniques</h3></div>
        {data.recentClients.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucune clinique" text="Inscrivez la première clinique cliente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Clinique</th>
                  <th className="label-s px-4 py-2.5">Statut</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Plan</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Commercial</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {data.recentClients.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.clinicName}</td>
                    <td className="px-4 py-3">{CLIENT_STATUS[c.status] ?? c.status}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{planName(c.planId)}{c.planAmount > 0 && <span className="num text-muted-foreground"> · {fcfa(c.planAmount)}/mois</span>}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{spName(c.commercialId)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{fDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Cliniques clientes ---------------- */
function ClientsTab() {
  const { data, isLoading, error, refetch } = useGetPlatformClients({ query: { staleTime: 15_000, retry: 1 } });
  const salespeople = useGetPlatformSalespeople({ query: { staleTime: 15_000, retry: 1 } });
  const plans = useGetPlatformPlans({ query: { staleTime: 15_000, retry: 1 } });
  const create = useCreatePlatformClient();
  const update = useUpdatePlatformClient();
  const remove = useDeletePlatformClient();
  const refresh = useRefreshPlatform();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformClient | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ clinicName: "", contactName: "", email: "", phone: "", source: "web", commercialId: "", ownerId: "", status: "trial" });
  const spName = (id: string) => {
    const sp = (salespeople.data ?? []).find((s) => s.id === id);
    return sp ? `${sp.firstName} ${sp.lastName}` : "—";
  };
  const planName = (id: string) => (plans.data ?? []).find((p) => p.id === id)?.name ?? "—";

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  function startNew() {
    setEditing(null);
    setF({ clinicName: "", contactName: "", email: "", phone: "", source: "web", commercialId: "", ownerId: "", status: "trial" });
    setErr("");
    setOpen(true);
  }
  function startEdit(c: PlatformClient) {
    setEditing(c);
    setF({ clinicName: c.clinicName, contactName: c.contactName, email: c.email, phone: c.phone, source: c.source, commercialId: c.commercialId, ownerId: c.ownerId, status: c.status });
    setErr("");
    setOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.clinicName.trim()) return setErr("Le nom de la clinique est obligatoire.");
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: { ...f, clinicName: f.clinicName.trim(), status: f.status as PlatformClient["status"], source: f.source as PlatformClient["source"] } });
        toast({ title: "Clinique mise à jour" });
      } else {
        await create.mutateAsync({ data: { clinicName: f.clinicName.trim(), contactName: f.contactName.trim(), email: f.email.trim(), phone: f.phone.trim(), source: f.source as PlatformClient["source"], commercialId: f.commercialId, ownerId: f.ownerId.trim() } });
        toast({ title: "Clinique inscrite", description: "Essai gratuit de 30 jours créé automatiquement." });
      }
      await refresh();
      setOpen(false);
    } catch (err) {
      setErr(errMsg(err));
    }
  }
  async function onDelete(c: PlatformClient) {
    if (!window.confirm(`Supprimer la clinique « ${c.clinicName} » ? Ses abonnements seront supprimés, ses ventes conservées.`)) return;
    try {
      await remove.mutateAsync({ id: c.id });
      await refresh();
      toast({ title: "Clinique supprimée" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">{data.length} clinique(s). La création inscrit la clinique en essai gratuit de 30 jours.</p>
        <Button onClick={startNew} data-testid="button-new-client"><Plus className="size-4 mr-1.5" /> Nouvelle clinique</Button>
      </div>
      {err && <div className="mb-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
      <div className="panel overflow-hidden rise">
        {data.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucune clinique cliente" text="Inscrivez la première clinique." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Clinique</th>
                  <th className="label-s px-4 py-2.5">Contact</th>
                  <th className="label-s px-4 py-2.5">Statut</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Source</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Commercial</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Plan</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Inscription</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0" data-testid={`row-client-${c.id}`}>
                    <td className="px-4 py-3 font-medium">{c.clinicName}</td>
                    <td className="px-4 py-3"><div>{c.contactName || "—"}</div><div className="text-xs text-muted-foreground">{c.email}</div></td>
                    <td className="px-4 py-3">{CLIENT_STATUS[c.status] ?? c.status}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{SOURCE_LABELS[c.source] ?? c.source}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{spName(c.commercialId)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{planName(c.planId)}{c.planAmount > 0 && <span className="num text-muted-foreground"> · {fcfa(c.planAmount)}/mois</span>}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{fDate(c.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(c)} data-testid={`button-edit-client-${c.id}`}>Modifier</Button>
                        <button className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(c)} aria-label="Supprimer" data-testid={`button-delete-client-${c.id}`}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Modifier la clinique" : "Nouvelle clinique cliente"}</DialogTitle>
            <DialogDescription>{editing ? editing.clinicName : "La clinique est inscrite en essai gratuit de 30 jours."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nom de la clinique"><input className="field" value={f.clinicName} maxLength={150} onChange={(e) => setF({ ...f, clinicName: e.target.value })} data-testid="input-client-name" /></Field>
              <Field label="Contact (nom)"><input className="field" value={f.contactName} maxLength={150} onChange={(e) => setF({ ...f, contactName: e.target.value })} data-testid="input-client-contact" /></Field>
              <Field label="E-mail"><input className="field" type="email" value={f.email} maxLength={150} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="input-client-email" /></Field>
              <Field label="Téléphone"><input className="field" value={f.phone} maxLength={30} placeholder="+228 90 00 00 00" onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="input-client-phone" /></Field>
              <Field label="Source">
                <select className="field" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} data-testid="select-client-source">
                  <option value="web">Web</option>
                  <option value="commercial">Commercial</option>
                  <option value="partner">Partenaire</option>
                </select>
              </Field>
              <Field label="Commercial assigné">
                <select className="field" value={f.commercialId} onChange={(e) => setF({ ...f, commercialId: e.target.value })} data-testid="select-client-salesperson">
                  <option value="">Aucun</option>
                  {(salespeople.data ?? []).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </Field>
              <Field label="Identifiant Clerk de la clinique (optionnel)" hint="user_… — lie la fiche à son compte Orion Santé pour appliquer l'abonnement.">
                <input className="field" value={f.ownerId} maxLength={200} placeholder="user_…" onChange={(e) => setF({ ...f, ownerId: e.target.value })} data-testid="input-client-owner" />
              </Field>
              {editing && (
                <Field label="Statut">
                  <select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} data-testid="select-client-status">
                    <option value="trial">Essai</option>
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </Field>
              )}
            </div>
            {err && <div className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} data-testid="button-submit-client">
                {(create.isPending || update.isPending) && <Loader2 className="size-4 mr-2 animate-spin" />} {editing ? "Enregistrer" : "Inscrire la clinique"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Commerciaux ---------------- */
function SalespeopleTab() {
  const { data, isLoading, error, refetch } = useGetPlatformSalespeople({ query: { staleTime: 15_000, retry: 1 } });
  const create = useCreatePlatformSalesperson();
  const update = useUpdatePlatformSalesperson();
  const remove = useDeletePlatformSalesperson();
  const refresh = useRefreshPlatform();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformSalesperson | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", region: "", commissionRate: "10", monthlyGoal: "500000", active: true });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  function startNew() {
    setEditing(null);
    setF({ firstName: "", lastName: "", email: "", phone: "", region: "", commissionRate: "10", monthlyGoal: "500000", active: true });
    setErr("");
    setOpen(true);
  }
  function startEdit(s: PlatformSalesperson) {
    setEditing(s);
    setF({ firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone, region: s.region, commissionRate: String(s.commissionRate), monthlyGoal: String(s.monthlyGoal), active: s.active });
    setErr("");
    setOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Nom et prénom sont obligatoires.");
    const payload = { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(), region: f.region.trim(), commissionRate: Math.min(100, Math.max(0, Number(f.commissionRate) || 0)), monthlyGoal: Math.max(0, intOnly(f.monthlyGoal)), active: f.active };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload });
        toast({ title: "Commercial mis à jour" });
      } else {
        await create.mutateAsync({ data: payload });
        toast({ title: "Commercial créé" });
      }
      await refresh();
      setOpen(false);
    } catch (err) {
      setErr(errMsg(err));
    }
  }
  async function onDelete(s: PlatformSalesperson) {
    if (!window.confirm(`Supprimer le commercial « ${s.firstName} ${s.lastName} » ? Ses ventes passées sont conservées.`)) return;
    try {
      await remove.mutateAsync({ id: s.id });
      await refresh();
      toast({ title: "Commercial supprimé" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }
  async function copyLink(s: PlatformSalesperson) {
    const link = `${window.location.origin}/sign-up?ref=${s.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(s.id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setErr("Copie impossible : copiez le lien manuellement.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">{data.length} commercial(aux). Commission par défaut : 10 % des ventes.</p>
        <Button onClick={startNew} data-testid="button-new-salesperson"><Plus className="size-4 mr-1.5" /> Nouveau commercial</Button>
      </div>
      {err && <div className="mb-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
      <div className="panel overflow-hidden rise">
        {data.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucun commercial" text="Ajoutez le premier commercial." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Commercial</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Région</th>
                  <th className="label-s px-4 py-2.5">Commission</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Objectif mensuel</th>
                  <th className="label-s px-4 py-2.5">Actif</th>
                  <th className="label-s px-4 py-2.5">Lien de parrainage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-b last:border-0" data-testid={`row-salesperson-${s.id}`}>
                    <td className="px-4 py-3"><div className="font-medium">{s.firstName} {s.lastName}</div><div className="text-xs text-muted-foreground">{s.email} · {s.phone || "—"}</div></td>
                    <td className="px-4 py-3 hidden md:table-cell">{s.region || "—"}</td>
                    <td className="px-4 py-3 num">{s.commissionRate} %</td>
                    <td className="px-4 py-3 hidden lg:table-cell num">{fcfa(s.monthlyGoal)}</td>
                    <td className="px-4 py-3">{s.active ? "Oui" : "Non"}</td>
                    <td className="px-4 py-3">
                      <button className="inline-flex items-center gap-1.5 text-xs rounded-lg border px-2 py-1.5 hover:bg-secondary" onClick={() => copyLink(s)} data-testid={`button-copy-ref-${s.id}`}>
                        {copied === s.id ? <Check className="size-3.5 text-lagoon" /> : <Copy className="size-3.5" />} {copied === s.id ? "Copié !" : "Copier le lien"}
                      </button>
                      <div className="text-[11px] text-muted-foreground mt-1 num truncate max-w-[220px]">/sign-up?ref={s.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(s)} data-testid={`button-edit-salesperson-${s.id}`}>Modifier</Button>
                        <button className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(s)} aria-label="Supprimer" data-testid={`button-delete-salesperson-${s.id}`}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Modifier le commercial" : "Nouveau commercial"}</DialogTitle>
            <DialogDescription>Le lien de parrainage /sign-up?ref=… est affiché dans le tableau.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Prénom"><input className="field" value={f.firstName} maxLength={100} onChange={(e) => setF({ ...f, firstName: e.target.value })} data-testid="input-sp-firstname" /></Field>
              <Field label="Nom"><input className="field" value={f.lastName} maxLength={100} onChange={(e) => setF({ ...f, lastName: e.target.value })} data-testid="input-sp-lastname" /></Field>
              <Field label="E-mail"><input className="field" type="email" value={f.email} maxLength={150} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="input-sp-email" /></Field>
              <Field label="Téléphone"><input className="field" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="input-sp-phone" /></Field>
              <Field label="Région"><input className="field" value={f.region} maxLength={100} placeholder="Maritime" onChange={(e) => setF({ ...f, region: e.target.value })} data-testid="input-sp-region" /></Field>
              <Field label="Commission (%)"><input className="field num" inputMode="decimal" value={f.commissionRate} onChange={(e) => setF({ ...f, commissionRate: e.target.value.replace(/[^0-9.]/g, "") })} data-testid="input-sp-commission" /></Field>
              <Field label="Objectif mensuel (FCFA)"><input className="field num" inputMode="numeric" value={f.monthlyGoal} onChange={(e) => setF({ ...f, monthlyGoal: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-sp-goal" /></Field>
              <Field label="Actif">
                <select className="field" value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })} data-testid="select-sp-active">
                  <option value="1">Oui</option>
                  <option value="0">Non</option>
                </select>
              </Field>
            </div>
            {err && <div className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} data-testid="button-submit-salesperson">
                {(create.isPending || update.isPending) && <Loader2 className="size-4 mr-2 animate-spin" />} {editing ? "Enregistrer" : "Créer le commercial"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Plans tarifaires ---------------- */
function PlansTab() {
  const { data, isLoading, error, refetch } = useGetPlatformPlans({ query: { staleTime: 15_000, retry: 1 } });
  const create = useCreatePlatformPlan();
  const update = useUpdatePlatformPlan();
  const remove = useDeletePlatformPlan();
  const refresh = useRefreshPlatform();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", priceMonthly: "9900", periodMonths: "1", maxUsers: "3", maxPatients: "200", maxStorageGb: "5", features: "", active: true });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  function startNew() {
    setEditing(null);
    setF({ name: "", priceMonthly: "9900", periodMonths: "1", maxUsers: "3", maxPatients: "200", maxStorageGb: "5", features: "", active: true });
    setErr("");
    setOpen(true);
  }
  function startEdit(p: PlatformPlan) {
    setEditing(p);
    setF({ name: p.name, priceMonthly: String(p.priceMonthly), periodMonths: String(p.periodMonths), maxUsers: String(p.maxUsers), maxPatients: String(p.maxPatients), maxStorageGb: String(p.maxStorageGb), features: p.features, active: p.active });
    setErr("");
    setOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) return setErr("Le nom du plan est obligatoire.");
    const payload = { name: f.name.trim(), priceMonthly: Math.max(0, intOnly(f.priceMonthly)), periodMonths: Math.max(1, intOnly(f.periodMonths)), maxUsers: Math.max(1, intOnly(f.maxUsers)), maxPatients: Math.max(1, intOnly(f.maxPatients)), maxStorageGb: Math.max(0, intOnly(f.maxStorageGb)), features: f.features.trim(), active: f.active };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload });
        toast({ title: "Plan mis à jour" });
      } else {
        await create.mutateAsync({ data: payload });
        toast({ title: "Plan créé" });
      }
      await refresh();
      setOpen(false);
    } catch (err) {
      setErr(errMsg(err));
    }
  }
  async function onDelete(p: PlatformPlan) {
    if (!window.confirm(`Supprimer le plan « ${p.name} » ? Impossible s'il est utilisé par un abonnement actif.`)) return;
    try {
      await remove.mutateAsync({ id: p.id });
      await refresh();
      toast({ title: "Plan supprimé" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  return (
    <div>
      <div className="mb-3 rounded-lg bg-saffron/20 px-3 py-2.5 text-sm">
        <span className="font-semibold">Prix provisoires.</span> Les montants ci-dessous sont modifiables ici à tout moment ; ils s'appliquent aux nouveaux abonnements, pas à ceux déjà créés.
      </div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">{data.length} plan(s). Les limites (utilisateurs, patients, stockage) sont appliquées à la création.</p>
        <Button onClick={startNew} data-testid="button-new-plan"><Plus className="size-4 mr-1.5" /> Nouveau plan</Button>
      </div>
      {err && <div className="mb-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
      <div className="panel overflow-hidden rise">
        {data.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucun plan" text="Créez le premier plan tarifaire." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Plan</th>
                  <th className="label-s px-4 py-2.5">Prix / mois</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Utilisateurs</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Patients</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Stockage</th>
                  <th className="label-s px-4 py-2.5">Actif</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" data-testid={`row-plan-${p.id}`}>
                    <td className="px-4 py-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.features}</div></td>
                    <td className="px-4 py-3 num">{fcfa(p.priceMonthly)}</td>
                    <td className="px-4 py-3 hidden md:table-cell num">{p.maxUsers}</td>
                    <td className="px-4 py-3 hidden md:table-cell num">{p.maxPatients.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 hidden lg:table-cell num">{p.maxStorageGb} Go</td>
                    <td className="px-4 py-3">{p.active ? "Oui" : "Non"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)} data-testid={`button-edit-plan-${p.id}`}>Modifier</Button>
                        <button className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(p)} aria-label="Supprimer" data-testid={`button-delete-plan-${p.id}`}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Modifier le plan" : "Nouveau plan"}</DialogTitle>
            <DialogDescription>Montants en FCFA. Les limites sont appliquées à la création de patients et de membres.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nom du plan"><input className="field" value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="input-plan-name" /></Field>
              <Field label="Prix mensuel (FCFA)"><input className="field num" inputMode="numeric" value={f.priceMonthly} onChange={(e) => setF({ ...f, priceMonthly: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-plan-price" /></Field>
              <Field label="Période (mois)"><input className="field num" inputMode="numeric" value={f.periodMonths} onChange={(e) => setF({ ...f, periodMonths: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-plan-period" /></Field>
              <Field label="Utilisateurs max"><input className="field num" inputMode="numeric" value={f.maxUsers} onChange={(e) => setF({ ...f, maxUsers: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-plan-users" /></Field>
              <Field label="Patients max"><input className="field num" inputMode="numeric" value={f.maxPatients} onChange={(e) => setF({ ...f, maxPatients: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-plan-patients" /></Field>
              <Field label="Stockage max (Go)"><input className="field num" inputMode="numeric" value={f.maxStorageGb} onChange={(e) => setF({ ...f, maxStorageGb: e.target.value.replace(/[^\d]/g, "") })} data-testid="input-plan-storage" /></Field>
              <Field label="Actif">
                <select className="field" value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })} data-testid="select-plan-active">
                  <option value="1">Oui</option>
                  <option value="0">Non</option>
                </select>
              </Field>
            </div>
            <Field label="Fonctionnalités (texte libre)"><textarea className="field" value={f.features} maxLength={2000} onChange={(e) => setF({ ...f, features: e.target.value })} data-testid="input-plan-features" /></Field>
            {err && <div className="text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} data-testid="button-submit-plan">
                {(create.isPending || update.isPending) && <Loader2 className="size-4 mr-2 animate-spin" />} {editing ? "Enregistrer" : "Créer le plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Abonnements ---------------- */
function SubscriptionsTab() {
  const { data, isLoading, error, refetch } = useGetPlatformSubscriptions({ query: { staleTime: 15_000, retry: 1 } });
  const clients = useGetPlatformClients({ query: { staleTime: 15_000, retry: 1 } });
  const plans = useGetPlatformPlans({ query: { staleTime: 15_000, retry: 1 } });
  const create = useCreatePlatformSubscription();
  const cancel = useCancelPlatformSubscription();
  const refresh = useRefreshPlatform();
  const { toast } = useToast();
  const [err, setErr] = useState("");
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(todayKey());
  const [duration, setDuration] = useState("12");

  const clientName = (id: string) => (clients.data ?? []).find((c) => c.id === id)?.clinicName ?? "Client supprimé";
  const planName = (id: string) => (plans.data ?? []).find((p) => p.id === id)?.name ?? "—";
  const selectedPlan = useMemo(() => (plans.data ?? []).find((p) => p.id === planId), [plans.data, planId]);

  if (isLoading || clients.isLoading || plans.isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!clientId || !planId) return setErr("Choisissez une clinique et un plan.");
    try {
      await create.mutateAsync({ data: { clientId, planId, startDate, durationMonths: Math.max(1, intOnly(duration)) } });
      await refresh();
      toast({ title: "Abonnement créé", description: "Vente confirmée enregistrée automatiquement, clinique passée en « Actif »." });
    } catch (err) {
      setErr(errMsg(err));
    }
  }
  async function onCancel(id: string) {
    if (!window.confirm("Annuler cet abonnement ? La clinique perdra l'accès à la fin de la période si aucun autre abonnement actif.")) return;
    try {
      await cancel.mutateAsync({ id });
      await refresh();
      toast({ title: "Abonnement annulé" });
    } catch (err) {
      setErr(errMsg(err));
    }
  }

  return (
    <div>
      <section className="panel p-5 rise mb-3">
        <h3 className="font-semibold mb-1">Nouvel abonnement</h3>
        <p className="text-sm text-muted-foreground mb-4">La création exige une clinique existante. Une vente confirmée est créée automatiquement (montant = prix × durée, commission selon le commercial assigné, 0 si aucun) et la clinique passe en « Actif ». L'essai en cours est remplacé.</p>
        <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label="Clinique">
            <select className="field" value={clientId} onChange={(e) => setClientId(e.target.value)} data-testid="select-sub-client">
              <option value="">Choisir…</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.clinicName}</option>)}
            </select>
          </Field>
          <Field label="Plan">
            <select className="field" value={planId} onChange={(e) => setPlanId(e.target.value)} data-testid="select-sub-plan">
              <option value="">Choisir…</option>
              {(plans.data ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {fcfa(p.priceMonthly)}/mois</option>)}
            </select>
          </Field>
          <Field label="Date de début"><input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-sub-start" /></Field>
          <Field label="Durée (mois)"><input className="field num" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, ""))} data-testid="input-sub-duration" /></Field>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Montant total</div>
            <div className="num font-semibold">{selectedPlan ? fcfa(selectedPlan.priceMonthly * Math.max(1, intOnly(duration))) : "—"}</div>
            <Button type="submit" className="mt-2" disabled={create.isPending} data-testid="button-create-subscription">
              {create.isPending && <Loader2 className="size-4 mr-2 animate-spin" />} Créer l'abonnement
            </Button>
          </div>
        </form>
        {err && <div className="mt-3 text-sm rounded-lg bg-destructive/10 text-destructive px-3 py-2">{err}</div>}
      </section>

      <div className="panel overflow-hidden rise">
        {data.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucun abonnement" text="Créez le premier abonnement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Clinique</th>
                  <th className="label-s px-4 py-2.5">Plan</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Début</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Fin</th>
                  <th className="label-s px-4 py-2.5">Montant</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Commission</th>
                  <th className="label-s px-4 py-2.5">Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const st = effectiveSubStatus(s);
                  return (
                    <tr key={s.id} className="border-b last:border-0" data-testid={`row-subscription-${s.id}`}>
                      <td className="px-4 py-3 font-medium">{clientName(s.clientId)}</td>
                      <td className="px-4 py-3">{planName(s.planId)} <span className="text-muted-foreground">· {s.durationMonths} mois</span></td>
                      <td className="px-4 py-3 hidden md:table-cell">{fDate(s.startDate)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{fDate(s.endDate)}</td>
                      <td className="px-4 py-3 num">{fcfa(s.amount)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell num">{fcfa(s.commission)}</td>
                      <td className="px-4 py-3">{SUB_STATUS[st] ?? st}</td>
                      <td className="px-3 py-3 text-right">
                        {st === "active" && <Button size="sm" variant="ghost" onClick={() => onCancel(s.id)} disabled={cancel.isPending} data-testid={`button-cancel-subscription-${s.id}`}>Annuler</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Ventes ---------------- */
function SalesTab() {
  const [source, setSource] = useState("all");
  const { data, isLoading, error, refetch } = useGetPlatformSales(
    { source: source === "all" ? undefined : source },
    { query: { staleTime: 15_000, retry: 1 } },
  );
  const clients = useGetPlatformClients({ query: { staleTime: 15_000, retry: 1 } });
  const salespeople = useGetPlatformSalespeople({ query: { staleTime: 15_000, retry: 1 } });
  const all = useGetPlatformSales({}, { query: { staleTime: 15_000, retry: 1 } });

  const clientName = (id: string) => (clients.data ?? []).find((c) => c.id === id)?.clinicName ?? "Client supprimé";
  const spName = (id: string) => {
    if (!id) return "—";
    const sp = (salespeople.data ?? []).find((s) => s.id === id);
    return sp ? `${sp.firstName} ${sp.lastName}` : "Commercial supprimé";
  };

  if (isLoading || all.isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const byChannel = (src: string) => (all.data ?? []).filter((s) => s.source === src);
  const sum = (list: { amount: number }[]) => list.reduce((n, s) => n + s.amount, 0);

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <Stat label="Ventes — Commerciaux" value={fcfa(sum(byChannel("commercial")))} hint={`${byChannel("commercial").length} vente(s)`} />
        <Stat label="Ventes — Web" value={fcfa(sum(byChannel("web")))} hint={`${byChannel("web").length} vente(s)`} />
        <Stat label="Ventes — Partenaires" value={fcfa(sum(byChannel("partner")))} hint={`${byChannel("partner").length} vente(s)`} />
      </div>
      <div className="mb-3">
        <Tabs
          value={source}
          onChange={setSource}
          items={[
            { value: "all", label: `Toutes (${(all.data ?? []).length})` },
            { value: "commercial", label: `Commerciaux (${byChannel("commercial").length})` },
            { value: "web", label: `Web (${byChannel("web").length})` },
            { value: "partner", label: `Partenaires (${byChannel("partner").length})` },
          ]}
        />
      </div>
      <div className="panel overflow-hidden rise">
        {data.length === 0 ? (
          <Empty icon={<Briefcase className="size-5" />} title="Aucune vente" text="Les ventes sont créées automatiquement à chaque abonnement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-secondary/50">
                  <th className="label-s px-4 py-2.5">Date</th>
                  <th className="label-s px-4 py-2.5">Clinique</th>
                  <th className="label-s px-4 py-2.5 hidden md:table-cell">Commercial</th>
                  <th className="label-s px-4 py-2.5">Source</th>
                  <th className="label-s px-4 py-2.5">Montant</th>
                  <th className="label-s px-4 py-2.5">Commission</th>
                  <th className="label-s px-4 py-2.5 hidden lg:table-cell">Libellé</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-b last:border-0" data-testid={`row-sale-${s.id}`}>
                    <td className="px-4 py-3 text-muted-foreground">{fDate(s.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{clientName(s.clientId)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{spName(s.commercialId)}</td>
                    <td className="px-4 py-3">{SOURCE_LABELS[s.source] ?? s.source}</td>
                    <td className="px-4 py-3 num">{fcfa(s.amount)}</td>
                    <td className="px-4 py-3 num">{fcfa(s.commission)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{s.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Guide ---------------- */
function GuideTab() {
  return (
    <div className="panel p-5 md:p-6 rise space-y-5 text-sm max-w-3xl">
      <h3 className="font-semibold text-base">Comment utiliser cet espace</h3>
      <section>
        <h4 className="font-semibold mb-1">1. Créer un plan tarifaire</h4>
        <p className="text-muted-foreground">Onglet « Plans tarifaires » → « Nouveau plan ». Indiquez le prix mensuel en FCFA, la période, les limites (utilisateurs, patients, stockage en Go) et les fonctionnalités. Les prix affichés sont provisoires et modifiables à tout moment ; un changement ne touche pas les abonnements déjà créés.</p>
      </section>
      <section>
        <h4 className="font-semibold mb-1">2. Essai gratuit en libre-service</h4>
        <p className="text-muted-foreground">La clinique crée d'abord son compte (« Créer ma clinique » sur la page d'accueil), puis démarre elle-même son essai gratuit de 30 jours depuis son tableau de bord : une carte lui propose l'essai, elle renseigne le nom de la clinique, son contact et son téléphone, et l'essai démarre immédiatement avec un abonnement d'essai. Un seul essai par clinique, non renouvelable par elle-même ; à la fin, l'accès est bloqué jusqu'à la création d'un abonnement payant (voir § 4). Si la clinique est arrivée par un lien de parrainage /sign-up?ref=…, l'essai est attribué au commercial.</p>
      </section>
      <section>
        <h4 className="font-semibold mb-1">3. Inscrire une clinique cliente</h4>
        <p className="text-muted-foreground">Onglet « Cliniques clientes » → « Nouvelle clinique ». La clinique est inscrite en essai gratuit de 30 jours, avec un abonnement d'essai créé automatiquement. Pour lier la fiche à son compte Orion Santé (et appliquer l'abonnement et les limites), renseignez son identifiant Clerk (tableau de bord Clerk → Users → ID commençant par user_…). Sans cet identifiant, la fiche reste un suivi commercial sans blocage d'accès.</p>
      </section>
      <section>
        <h4 className="font-semibold mb-1">4. Créer un abonnement payant</h4>
        <p className="text-muted-foreground">Onglet « Abonnements » : choisissez la clinique, le plan, la date de début et la durée. Une vente confirmée est créée automatiquement (montant = prix × durée, commission selon le commercial assigné, 0 si aucun) et la clinique passe en « Actif ». L'essai en cours est remplacé. Un abonnement expiré (essai ou payant) bloque l'accès de la clinique avec un message explicite ; l'annulation est possible depuis le tableau.</p>
      </section>
      <section>
        <h4 className="font-semibold mb-1">5. Parrainage et commissions</h4>
        <p className="text-muted-foreground">Chaque commercial a un lien de parrainage /sign-up?ref=… (onglet « Commerciaux », bouton « Copier le lien »). Quand une clinique s'inscrit par ce lien puis démarre son essai gratuit depuis son tableau de bord, l'essai lui est attribué. La commission par défaut est de 10 % des ventes issues de ses cliniques ; le taux se règle par commercial. Les ventes sont ventilées par canal dans l'onglet « Ventes » (Commerciaux / Web / Partenaires).</p>
      </section>
      <section>
        <h4 className="font-semibold mb-1">6. Ce qui n'est pas encore en place</h4>
        <p className="text-muted-foreground">Paiement en ligne (FedaPay/Stripe), renouvellement automatique des abonnements et courriels (bienvenue, fin d'essai) : les abonnements sont créés manuellement par l'administrateur dans cet espace.</p>
      </section>
    </div>
  );
}
