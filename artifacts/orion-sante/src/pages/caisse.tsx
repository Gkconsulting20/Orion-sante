import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Lock, Unlock, Plus, Wallet, Loader2 } from "lucide-react";
import { useSetCashSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRefresh, useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, Field, PageHeader, PageSkeleton, Stat, Tabs } from "@/components/kit";
import { ExpenseDialog } from "@/components/dialogs";
import { CATEGORY, METHOD, errMsg, fDateTime, fcfa, fullName, intOnly, num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

type Row = { id: string; at: string; dir: "in" | "out"; label: string; sub: string; method: string; amount: number };

export default function Caisse() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const setCash = useSetCashSession();
  const refresh = useRefresh();
  const { toast } = useToast();
  const [opening, setOpening] = useState("0");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [method, setMethod] = useState("all");
  const [expOpen, setExpOpen] = useState(false);
  const [cashErr, setCashErr] = useState("");

  const rows = useMemo<Row[]>(() => {
    if (!ws) return [];
    const ins: Row[] = ws.payments.map((p) => ({ id: p.id, at: p.createdAt, dir: "in", label: `Reçu ${p.receiptNumber}`, sub: fullName(ws.patients.find((x) => x.id === p.patientId)), method: p.method, amount: p.amount }));
    const outs: Row[] = ws.expenses.map((e) => ({ id: e.id, at: e.createdAt, dir: "out", label: e.label, sub: `${CATEGORY[e.category]}${e.supplier ? ` · ${e.supplier}` : ""}`, method: e.method, amount: e.amount }));
    return [...ins, ...outs].sort((a, b) => b.at.localeCompare(a.at));
  }, [ws]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;

  const cs = ws.cashSession;
  const since = cs.isOpen ? cs.openedAt : "";
  const sessionRows = cs.isOpen ? rows.filter((r) => r.method === "cash" && r.at >= since) : [];
  const cashIn = sessionRows.filter((r) => r.dir === "in").reduce((s, r) => s + r.amount, 0);
  const cashOut = sessionRows.filter((r) => r.dir === "out").reduce((s, r) => s + r.amount, 0);
  const expected = cs.openingBalance + cashIn - cashOut;
  const shown = rows.filter((r) => (dir === "all" || r.dir === dir) && (method === "all" || r.method === method));
  const totIn = shown.filter((r) => r.dir === "in").reduce((s, r) => s + r.amount, 0);
  const totOut = shown.filter((r) => r.dir === "out").reduce((s, r) => s + r.amount, 0);

  async function toggle(action: "open" | "close") {
    setCashErr("");
    try {
      await setCash.mutateAsync({ data: { action, openingBalance: action === "open" ? intOnly(opening) : cs.openingBalance } });
      await refresh();
      toast({ title: action === "open" ? "Caisse ouverte" : "Caisse fermée" });
    } catch (e) {
      setCashErr(errMsg(e));
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Trésorerie" title="Caisse" sub="Journal des entrées et sorties. Les paiements en espèces exigent une session de caisse ouverte."
        actions={<Button onClick={() => setExpOpen(true)} data-testid="button-new-expense"><Plus className="size-4 mr-1.5" /> Nouvelle dépense</Button>} />

      <div className="grid lg:grid-cols-[360px_1fr] gap-3 mb-3">
        <section className={cn("rounded-2xl p-5 rise relative overflow-hidden", cs.isOpen ? "bg-ink text-primary-foreground star-field" : "panel")} data-testid="panel-cash-session">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("size-2 rounded-full", cs.isOpen ? "bg-[hsl(172_58%_50%)] pulse-dot" : "bg-muted-foreground/40")} />
            <span className="label-s !text-current opacity-80">{cs.isOpen ? "Session ouverte" : "Caisse fermée"}</span>
          </div>
          {cs.isOpen ? (
            <>
              <div className="text-xs opacity-70">Depuis le {fDateTime(cs.openedAt)}</div>
              <div className="mt-4 label-s !text-current opacity-70">Espèces attendues en caisse</div>
              <div className="num text-3xl font-semibold mt-1" data-testid="text-expected-cash">{fcfa(expected)}</div>
              <dl className="grid grid-cols-3 gap-2 mt-4 text-xs">
                <div><dt className="opacity-60">Fond</dt><dd className="num">{num(cs.openingBalance)}</dd></div>
                <div><dt className="opacity-60">Entrées</dt><dd className="num">+{num(cashIn)}</dd></div>
                <div><dt className="opacity-60">Sorties</dt><dd className="num">-{num(cashOut)}</dd></div>
              </dl>
              <Button variant="secondary" className="w-full mt-5" disabled={setCash.isPending} onClick={() => toggle("close")} data-testid="button-close-cash">
                {setCash.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Lock className="size-4 mr-2" />} Fermer la caisse
              </Button>
            </>
          ) : (
            <>
              {cs.closedAt && <div className="text-xs text-muted-foreground">Dernière fermeture : {fDateTime(cs.closedAt)} · solde {fcfa(cs.closingBalance)}</div>}
              <Field label="Fond de caisse initial (FCFA)" className="mt-4">
                <input className="field num text-lg h-11" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d]/g, ""))} data-testid="input-opening-balance" />
              </Field>
              <Button className="w-full mt-4" disabled={setCash.isPending} onClick={() => toggle("open")} data-testid="button-open-cash">
                {setCash.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Unlock className="size-4 mr-2" />} Ouvrir la caisse
              </Button>
            </>
          )}
          {cashErr && <p className="text-xs text-destructive mt-2">{cashErr}</p>}
        </section>
        <div className="grid grid-cols-2 gap-3 content-start">
          <Stat label="Entrées (filtre)" value={fcfa(totIn)} tone="lagoon" />
          <Stat label="Sorties (filtre)" value={fcfa(totOut)} tone="saffron" />
          <Stat label="Solde net (filtre)" value={fcfa(totIn - totOut)} className="col-span-2" hint="Calcul opérationnel sur les mouvements enregistrés." />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <Tabs value={dir} onChange={setDir} items={[{ value: "all", label: "Tout" }, { value: "in", label: "Entrées" }, { value: "out", label: "Sorties" }]} />
        <select className="field w-48 ml-auto" value={method} onChange={(e) => setMethod(e.target.value)} data-testid="select-ledger-method">
          <option value="all">Tous les modes</option>
          {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="panel overflow-hidden">
        {shown.length === 0 ? <Empty icon={<Wallet className="size-5" />} title="Journal vide" text="Les paiements et dépenses enregistrés apparaîtront ici." /> : (
          <ul className="divide-y">
            {shown.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3 row-hover" data-testid={`row-ledger-${r.id}`}>
                <span className={cn("size-8 rounded-lg grid place-items-center", r.dir === "in" ? "bg-lagoon/12 text-lagoon" : "bg-accent text-accent-foreground")}>
                  {r.dir === "in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.sub} · {METHOD[r.method]} · {fDateTime(r.at)}</div>
                </div>
                <span className={cn("num text-sm font-medium whitespace-nowrap", r.dir === "in" ? "text-lagoon" : "")}>{r.dir === "in" ? "+" : "-"}{fcfa(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ExpenseDialog open={expOpen} onOpenChange={setExpOpen} ws={ws} />
    </div>
  );
}
