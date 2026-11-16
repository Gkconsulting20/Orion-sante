import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-clinic";
import { ErrorState, Field, PageHeader, PageSkeleton, Stat } from "@/components/kit";
import { CATEGORY, INVOICE_STATUS, METHOD, addDays, dayKey, fcfa, fullName, remaining, todayKey } from "@/lib/fmt";

function csv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Bars({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-muted-foreground py-4">Aucune donnée sur la période.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex justify-between text-sm gap-2"><span className="truncate">{i.label}{i.sub && <span className="text-xs text-muted-foreground"> · {i.sub}</span>}</span><span className="num">{fcfa(i.value)}</span></div>
          <div className="h-1.5 bg-secondary rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-ink rounded-full origin-left transition-transform duration-500" style={{ transform: `scaleX(${i.value / max})` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Rapports() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const t = todayKey();
  const [from, setFrom] = useState(`${t.slice(0, 7)}-01`);
  const [to, setTo] = useState(t);

  const r = useMemo(() => {
    if (!ws) return null;
    const inR = (iso: string) => { const k = dayKey(iso); return k >= from && k <= to; };
    const pays = ws.payments.filter((p) => inR(p.createdAt));
    const exps = ws.expenses.filter((e) => inR(e.createdAt));
    const invs = ws.invoices.filter((i) => inR(i.createdAt));
    const group = <T,>(arr: T[], key: (x: T) => string, val: (x: T) => number) => {
      const m = new Map<string, { value: number; count: number }>();
      arr.forEach((x) => { const k = key(x); const c = m.get(k) ?? { value: 0, count: 0 }; m.set(k, { value: c.value + val(x), count: c.count + 1 }); });
      return [...m.entries()].map(([label, v]) => ({ label, value: v.value, sub: `${v.count}` })).sort((a, b) => b.value - a.value);
    };
    const invById = new Map(ws.invoices.map((i) => [i.id, i]));
    return {
      pays, exps, invs,
      receipts: pays.reduce((s, p) => s + p.amount, 0),
      expenses: exps.reduce((s, e) => s + e.amount, 0),
      billed: invs.reduce((s, i) => s + i.total, 0),
      byMethod: group(pays, (p) => METHOD[p.method], (p) => p.amount),
      byService: group(pays, (p) => invById.get(p.invoiceId)?.service ?? "Autre", (p) => p.amount),
      byBilledService: group(invs, (i) => i.service, (i) => i.total),
      byCategory: group(exps, (e) => CATEGORY[e.category], (e) => e.amount),
    };
  }, [ws, from, to]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws || !r) return <ErrorState error={error} onRetry={() => refetch()} />;
  const pName = (id: string) => fullName(ws.patients.find((p) => p.id === id));
  const outstanding = ws.invoices.reduce((s, i) => s + remaining(i), 0);
  const tag = `${from}_${to}`;
  const presets = [
    { label: "Aujourd'hui", f: t, t },
    { label: "7 jours", f: addDays(t, -6), t },
    { label: "Ce mois", f: `${t.slice(0, 7)}-01`, t },
    { label: "30 jours", f: addDays(t, -29), t },
  ];

  return (
    <div>
      <PageHeader eyebrow="Pilotage" title="Rapports financiers" sub="Synthèse opérationnelle des encaissements, dépenses et prestations."
        actions={
          <>
            <Button variant="outline" onClick={() => csv(`encaissements_${tag}.csv`, ["Date", "Reçu", "Patient", "Facture", "Prestation", "Mode", "Référence", "Montant FCFA"], r.pays.map((p) => { const i = ws.invoices.find((x) => x.id === p.invoiceId); return [p.createdAt, p.receiptNumber, pName(p.patientId), i?.number ?? "", i?.service ?? "", METHOD[p.method], p.reference, p.amount]; }))} data-testid="button-export-payments"><Download className="size-4 mr-1.5" /> Encaissements</Button>
            <Button variant="outline" onClick={() => csv(`depenses_${tag}.csv`, ["Date", "Libellé", "Fournisseur", "Catégorie", "Mode", "Montant FCFA"], r.exps.map((e) => [e.createdAt, e.label, e.supplier, CATEGORY[e.category], METHOD[e.method], e.amount]))} data-testid="button-export-expenses"><Download className="size-4 mr-1.5" /> Dépenses</Button>
            <Button variant="outline" onClick={() => csv(`factures_${tag}.csv`, ["Date", "Facture", "Patient", "Prestation", "Total FCFA", "Payé FCFA", "Reste FCFA", "Statut"], r.invs.map((i) => [i.createdAt, i.number, pName(i.patientId), i.service, i.total, i.paid, remaining(i), INVOICE_STATUS[i.status]]))} data-testid="button-export-invoices"><Download className="size-4 mr-1.5" /> Factures</Button>
          </>
        } />

      <div className="panel p-4 mb-4 flex flex-wrap gap-3 items-end rise">
        <Field label="Du"><input type="date" className="field" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} data-testid="input-report-from" /></Field>
        <Field label="Au"><input type="date" className="field" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} data-testid="input-report-to" /></Field>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.label} onClick={() => { setFrom(p.f); setTo(p.t); }} className={`text-xs px-3 py-2 rounded-lg transition ${from === p.f && to === p.t ? "bg-ink text-primary-foreground" : "bg-secondary hover:brightness-95"}`} data-testid={`button-preset-${p.label}`}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat label="Encaissé" value={fcfa(r.receipts)} tone="lagoon" hint={`${r.pays.length} reçu(s)`} />
        <Stat label="Dépenses" value={fcfa(r.expenses)} tone="saffron" hint={`${r.exps.length} sortie(s)`} />
        <Stat label="Résultat de trésorerie" value={fcfa(r.receipts - r.expenses)} hint="Encaissé moins dépenses" />
        <Stat label="Facturé sur la période" value={fcfa(r.billed)} tone="danger" hint={`Reste dû global : ${fcfa(outstanding)}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <section className="panel p-5"><h3 className="font-semibold mb-4">Encaissements par prestation</h3><Bars items={r.byService} /></section>
        <section className="panel p-5"><h3 className="font-semibold mb-4">Facturé par prestation</h3><Bars items={r.byBilledService} /></section>
        <section className="panel p-5"><h3 className="font-semibold mb-4">Encaissements par mode</h3><Bars items={r.byMethod} /></section>
        <section className="panel p-5"><h3 className="font-semibold mb-4">Dépenses par catégorie</h3><Bars items={r.byCategory} /></section>
      </div>

      <p className="text-xs text-muted-foreground mt-5 flex gap-2 items-start"><Info className="size-3.5 mt-0.5 shrink-0" /> Ces rapports sont des synthèses de gestion opérationnelle. Ils ne constituent pas une comptabilité générale complète ni des états financiers certifiés. Exports CSV au format point-virgule, compatibles tableur.</p>
    </div>
  );
}
