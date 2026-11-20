import { useMemo } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Clock, Activity as ActivityIcon, Receipt, LogIn } from "lucide-react";
import { useDashboard, useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, PageHeader, PageSkeleton, Stat, VisitBadge } from "@/components/kit";
import { fDate, fTime, fcfa, fullName, num, remaining, todayKey, dayKey, fDateTime } from "@/lib/fmt";

export default function Dashboard() {
  const dash = useDashboard();
  const wsq = useWorkspace();
  const ws = wsq.data;
  const d = dash.data;

  const queue = useMemo(() => {
    if (!ws) return [];
    const t = todayKey();
    return ws.visits
      .filter((v) => dayKey(v.scheduledAt) === t && (v.status === "waiting" || v.status === "in_progress" || v.status === "scheduled"))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [ws]);
  const unpaid = useMemo(() => (ws ? ws.invoices.filter((i) => i.status !== "paid").sort((a, b) => remaining(b) - remaining(a)).slice(0, 5) : []), [ws]);

  if (dash.isLoading || wsq.isLoading) return <PageSkeleton />;
  if (dash.error || wsq.error || !d || !ws) return <ErrorState error={dash.error || wsq.error} onRetry={() => { dash.refetch(); wsq.refetch(); }} />;

  const pName = (id: string) => fullName(ws.patients.find((p) => p.id === id));
  const svcMax = Math.max(1, ...d.services.map((s) => s.amount));
  const net = d.receiptsMonth - d.expensesMonth;

  return (
    <div>
      {ws.isDemo && (
        <Show when="signed-out">
          <div className="panel overflow-hidden mb-6 rise bg-ink text-primary-foreground star-field border-0">
            <div className="p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <div className="label-s !text-saffron mb-2">Démonstration en direct · données fictives</div>
                <h2 className="text-2xl md:text-3xl font-semibold max-w-2xl leading-tight">Le soin du patient et chaque franc de sa facture, sur le même fil.</h2>
                <p className="text-sm text-primary-foreground/70 mt-2 max-w-xl">Explorez librement : dossiers, consultations, factures, reçus et caisse. Ne saisissez aucune donnée réelle ici — connectez-vous pour obtenir votre clinique privée, vide et séparée.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-saffron text-[hsl(226_49%_14%)] px-4 py-2.5 text-sm font-semibold hover:brightness-105 transition" data-testid="link-hero-sign-up">Créer ma clinique <ArrowRight className="size-4" /></Link>
                <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 px-4 py-2.5 text-sm hover:bg-primary-foreground/10 transition" data-testid="link-hero-sign-in"><LogIn className="size-4" /> Se connecter</Link>
              </div>
            </div>
          </div>
        </Show>
      )}

      <PageHeader eyebrow={ws.settings.clinicName} title="Activité du jour" sub="Patients, file d'attente et encaissements — mis à jour à chaque saisie." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat label="Encaissé aujourd'hui" value={fcfa(d.receiptsToday)} tone="lagoon" testId="stat-receipts-today" className="rise-1" />
        <Stat label="Consultations du jour" value={num(d.visitsToday)} hint={`${d.waitingToday} en attente`} testId="stat-visits-today" className="rise-2" />
        <Stat label="Reste à recouvrer" value={fcfa(d.unpaidTotal)} tone="danger" testId="stat-unpaid" className="rise-3" />
        <Stat label="Patients" value={num(d.patientsTotal)} hint={`${d.patientsToday} nouveau(x) aujourd'hui`} tone="saffron" testId="stat-patients" className="rise-4" />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 mb-3">
        <section className="panel p-5 rise">
          <div className="flex flex-wrap justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold">Recettes et dépenses</h3>
              <p className="text-xs text-muted-foreground">Période récente, en FCFA</p>
            </div>
            <div className="flex gap-5 text-right">
              <div><div className="label-s">Recettes du mois</div><div className="num font-semibold text-lagoon">{fcfa(d.receiptsMonth)}</div></div>
              <div><div className="label-s">Dépenses</div><div className="num font-semibold">{fcfa(d.expensesMonth)}</div></div>
              <div><div className="label-s">Résultat du mois</div><div className={`num font-semibold ${net < 0 ? "text-destructive" : ""}`}>{fcfa(net)}</div></div>
            </div>
          </div>
          {d.revenue.length === 0 ? (
            <Empty icon={<ActivityIcon className="size-5" />} title="Pas encore de mouvement" text="Les encaissements et dépenses apparaîtront ici." />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.revenue} margin={{ left: 0, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(172 58% 32%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(172 58% 32%)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(36 20% 88%)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => fDate(v).slice(0, 6)} tick={{ fontSize: 11, fill: "hsl(226 12% 42%)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11, fill: "hsl(226 12% 42%)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: number, n: string) => [fcfa(v), n === "receipts" ? "Recettes" : "Dépenses"]} labelFormatter={(l: string) => fDate(l)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(36 20% 86%)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="receipts" stroke="hsl(172 58% 32%)" strokeWidth={2} fill="url(#gr)" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(36 88% 52%)" strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="panel p-5 rise">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">File d'attente</h3>
            <Link href="/consultations" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="link-queue">Tout voir <ArrowRight className="size-3" /></Link>
          </div>
          {queue.length === 0 ? (
            <Empty icon={<Clock className="size-5" />} title="Personne en attente" text="Les patients arrivés aujourd'hui s'afficheront ici." />
          ) : (
            <ol className="space-y-1">
              {queue.slice(0, 7).map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-2 row-hover" data-testid={`row-queue-${v.id}`}>
                  <span className="num text-xs text-muted-foreground w-5">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{pName(v.patientId)}</div>
                    <div className="text-xs text-muted-foreground truncate">{fTime(v.scheduledAt)} · {v.service} · {v.practitioner}</div>
                  </div>
                  <VisitBadge status={v.status} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <section className="panel p-5 rise">
          <h3 className="font-semibold mb-3">Recettes par prestation</h3>
          {d.services.length === 0 ? <p className="text-sm text-muted-foreground">Aucune prestation facturée.</p> : (
            <ul className="space-y-3">
              {d.services.slice(0, 6).map((s) => (
                <li key={s.name}>
                  <div className="flex justify-between text-sm"><span className="truncate">{s.name} <span className="text-muted-foreground text-xs">× {s.count}</span></span><span className="num">{fcfa(s.amount)}</span></div>
                  <div className="h-1.5 bg-secondary rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-ink rounded-full origin-left transition-transform duration-700" style={{ transform: `scaleX(${s.amount / svcMax})` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5 rise">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Soldes à recouvrer</h3>
            <Link href="/facturation" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Facturation <ArrowRight className="size-3" /></Link>
          </div>
          {unpaid.length === 0 ? <Empty icon={<Receipt className="size-5" />} title="Tout est soldé" /> : (
            <ul className="divide-y">
              {unpaid.map((i) => (
                <li key={i.id} className="py-2.5 flex justify-between gap-3">
                  <div className="min-w-0"><div className="text-sm truncate">{pName(i.patientId)}</div><div className="text-xs text-muted-foreground num">{i.number}</div></div>
                  <div className="num text-sm text-destructive whitespace-nowrap">{fcfa(remaining(i))}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5 rise">
          <h3 className="font-semibold mb-3">Journal d'activité</h3>
          {ws.activity.length === 0 ? <p className="text-sm text-muted-foreground">Aucune activité pour le moment.</p> : (
            <ul className="relative space-y-3 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
              {ws.activity.slice(0, 7).map((a) => (
                <li key={a.id} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card bg-saffron" />
                  <div className="text-sm leading-snug">{a.label}</div>
                  <div className="text-[11px] text-muted-foreground">{fDateTime(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
