import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Printer, Receipt, Search, Wallet } from "lucide-react";
import type { Invoice, Payment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-clinic";
import { Empty, ErrorState, InvoiceBadge, PageHeader, PageSkeleton, Stat, Tabs } from "@/components/kit";
import { InvoiceDialog, PaymentDialog, ReceiptDialog } from "@/components/dialogs";
import { InvoiceDoc, usePrint } from "@/components/print";
import { METHOD, fDate, fDateTime, fcfa, fullName, num, patientDisplayName, remaining } from "@/lib/fmt";

type F = "open" | "all" | "paid";

export default function Facturation() {
  const { data: ws, isLoading, error, refetch } = useWorkspace();
  const { print } = usePrint();
  const [filter, setFilter] = useState<F>("open");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const list = useMemo(() => {
    if (!ws) return [];
    const s = q.trim().toLowerCase();
    return ws.invoices
      .filter((i) => (filter === "all" ? true : filter === "paid" ? i.status === "paid" : i.status !== "paid"))
      .filter((i) => !s || `${i.number} ${i.service} ${fullName(ws.patients.find((p) => p.id === i.patientId))}`.toLowerCase().includes(s))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [ws, filter, q]);

  if (isLoading) return <PageSkeleton />;
  if (error || !ws) return <ErrorState error={error} onRetry={() => refetch()} />;

  const pOf = (id: string) => ws.patients.find((p) => p.id === id);
  const open = ws.invoices.filter((i) => i.status !== "paid");
  const outstanding = open.reduce((s, i) => s + remaining(i), 0);
  const billed = ws.invoices.reduce((s, i) => s + i.total, 0);
  const collected = ws.invoices.reduce((s, i) => s + i.paid, 0);
  const recent = [...ws.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Facturation" title="Factures et paiements" sub="Factures multi-lignes rattachées au patient, paiements partiels ou complets, reçus imprimables."
        actions={<Button onClick={() => setNewOpen(true)} data-testid="button-new-invoice"><Plus className="size-4 mr-1.5" /> Nouvelle facture</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Reste à recouvrer" value={fcfa(outstanding)} tone="danger" hint={`${open.length} facture(s) ouverte(s)`} testId="stat-outstanding" />
        <Stat label="Total facturé" value={fcfa(billed)} hint={`${ws.invoices.length} facture(s)`} />
        <Stat label="Total encaissé" value={fcfa(collected)} tone="lagoon" />
        <Stat label="Taux de recouvrement" value={`${billed ? ((collected / billed) * 100).toLocaleString("fr-TG", { maximumFractionDigits: 1 }) : "0"} %`} tone="saffron" />
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-3">
        <div>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <Tabs value={filter} onChange={setFilter} items={[{ value: "open", label: "À encaisser", count: open.length }, { value: "paid", label: "Soldées" }, { value: "all", label: "Toutes" }]} />
            <div className="relative flex-1 min-w-52 max-w-sm ml-auto">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="search" className="field pl-9" placeholder="N°, patient, prestation…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search-invoices" />
            </div>
          </div>
          <div className="panel overflow-hidden">
            {list.length === 0 ? (
              <Empty icon={<Receipt className="size-5" />} title={filter === "open" ? "Aucun solde en attente" : "Aucune facture"} text="Créez une facture depuis ici, un dossier patient ou une consultation." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-secondary/50">
                      <th className="label-s px-4 py-2.5">Facture</th>
                      <th className="label-s px-4 py-2.5">Patient</th>
                      <th className="label-s px-4 py-2.5 text-right hidden md:table-cell">Total</th>
                      <th className="label-s px-4 py-2.5 text-right hidden md:table-cell">Payé</th>
                      <th className="label-s px-4 py-2.5 text-right">Reste</th>
                      <th className="label-s px-4 py-2.5">Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id} className="border-b last:border-0 row-hover" data-testid={`row-invoice-${i.id}`}>
                        <td className="px-4 py-3"><div className="num text-xs">{i.number}</div><div className="text-xs text-muted-foreground">{fDate(i.createdAt)} · {i.service}</div></td>
                        <td className="px-4 py-3"><Link href={`/patients/${i.patientId}`} className="hover:underline">{patientDisplayName(pOf(i.patientId), i.anonymized)}</Link></td>
                        <td className="px-4 py-3 text-right num hidden md:table-cell">{num(i.total)}</td>
                        <td className="px-4 py-3 text-right num text-lagoon hidden md:table-cell">{num(i.paid)}</td>
                        <td className={`px-4 py-3 text-right num font-medium ${remaining(i) ? "text-destructive" : "text-muted-foreground"}`}>{num(remaining(i))}</td>
                        <td className="px-4 py-3"><InvoiceBadge status={i.status} /></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <button className="size-8 grid place-items-center rounded-md hover:bg-secondary" onClick={() => print(<InvoiceDoc invoice={i} patient={pOf(i.patientId)} settings={ws.settings} />)} aria-label="Imprimer" data-testid={`button-print-invoice-${i.id}`}><Printer className="size-4" /></button>
                            {i.status !== "paid" && <Button size="sm" onClick={() => setPayInv(i)} data-testid={`button-pay-${i.id}`}><Wallet className="size-3.5 mr-1" /> Encaisser</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="panel h-fit">
          <div className="px-4 py-3.5 border-b font-display font-semibold text-sm">Derniers reçus</div>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground p-4">Aucun paiement encore.</p> : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li key={p.id}>
                  <button className="w-full text-left px-4 py-3 row-hover flex gap-3 items-center" onClick={() => setReceipt(p)} data-testid={`button-receipt-${p.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{patientDisplayName(pOf(p.patientId), p.anonymized)}</div>
                      <div className="text-[11px] text-muted-foreground num">{p.receiptNumber} · {METHOD[p.method]}</div>
                      <div className="text-[11px] text-muted-foreground">{fDateTime(p.createdAt)}</div>
                    </div>
                    <span className="num text-sm text-lagoon">{num(p.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <InvoiceDialog open={newOpen} onOpenChange={setNewOpen} ws={ws} onCreated={(inv) => setPayInv(inv)} />
      <PaymentDialog open={!!payInv} onOpenChange={(o) => !o && setPayInv(null)} ws={ws} invoice={payInv} onPaid={setReceipt} />
      <ReceiptDialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} ws={ws} payment={receipt} />
    </div>
  );
}
