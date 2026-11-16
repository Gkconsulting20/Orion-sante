import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Invoice, Patient, Payment, Settings, Visit } from "@workspace/api-client-react";
import { METHOD, age, fDate, fDateTime, fcfa, fullName, num } from "@/lib/fmt";

type Ctx = { print: (node: ReactNode) => void };
const PrintCtx = createContext<Ctx>({ print: () => undefined });
export const usePrint = () => useContext(PrintCtx);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<ReactNode>(null);
  useEffect(() => {
    const after = () => setDoc(null);
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);
  const print = useCallback((node: ReactNode) => {
    setDoc(node);
    setTimeout(() => window.print(), 120);
  }, []);
  return (
    <PrintCtx.Provider value={{ print }}>
      {children}
      {doc && createPortal(<div className="print-root">{doc}</div>, document.body)}
    </PrintCtx.Provider>
  );
}

function Letterhead({ s, kind, number, date }: { s: Settings; kind: string; number: string; date: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1c2a52", paddingBottom: 12, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1c2a52" }}>{s.clinicName}</div>
        {s.address && <div style={{ fontSize: 11 }}>{s.address}</div>}
        <div style={{ fontSize: 11 }}>{[s.phone, s.email].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9a6a12", fontWeight: 700 }}>{kind}</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{number}</div>
        <div style={{ fontSize: 11 }}>{date}</div>
      </div>
    </div>
  );
}

const cell = { padding: "6px 8px", borderBottom: "1px solid #ddd", fontSize: 12 } as const;
const right = { ...cell, textAlign: "right" as const, fontFamily: "JetBrains Mono, monospace" };

function Signatures({ left, rightLabel }: { left: string; rightLabel: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, fontSize: 11 }}>
      <div style={{ width: "42%", borderTop: "1px solid #999", paddingTop: 6 }}>{left}</div>
      <div style={{ width: "42%", borderTop: "1px solid #999", paddingTop: 6 }}>{rightLabel}</div>
    </div>
  );
}

export function ReceiptDoc({ payment, invoice, patient, settings, before, after }: { payment: Payment; invoice?: Invoice; patient?: Patient; settings: Settings; before: number; after: number }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Letterhead s={settings} kind="Reçu de paiement" number={payment.receiptNumber} date={fDateTime(payment.createdAt)} />
      <table style={{ width: "100%", fontSize: 12, marginBottom: 16 }}>
        <tbody>
          <tr><td style={{ color: "#666", width: 160 }}>Patient</td><td><b>{fullName(patient)}</b> {patient && `(${patient.number})`}</td></tr>
          <tr><td style={{ color: "#666" }}>Facture</td><td>{invoice?.number ?? "—"} · {invoice?.service}</td></tr>
          <tr><td style={{ color: "#666" }}>Total facture</td><td style={{ fontFamily: "JetBrains Mono, monospace" }}>{fcfa(invoice?.total ?? 0)}</td></tr>
          <tr><td style={{ color: "#666" }}>Mode de paiement</td><td>{METHOD[payment.method]}{payment.reference ? ` · Réf. ${payment.reference}` : ""}</td></tr>
        </tbody>
      </table>
      <div style={{ border: "2px solid #1c2a52", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5 }}>Montant reçu</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{fcfa(payment.amount)}</div>
      </div>
      <table style={{ width: "100%", marginTop: 12 }}>
        <tbody>
          <tr><td style={cell}>Solde avant ce paiement</td><td style={right}>{fcfa(before)}</td></tr>
          <tr><td style={cell}>Paiement</td><td style={right}>- {fcfa(payment.amount)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>Reste à payer</td><td style={{ ...right, fontWeight: 700 }}>{fcfa(after)}</td></tr>
        </tbody>
      </table>
      <Signatures left="Signature du caissier" rightLabel="Signature du patient" />
      {settings.receiptFooter && <p style={{ fontSize: 10, color: "#666", marginTop: 24, textAlign: "center" }}>{settings.receiptFooter}</p>}
      <p style={{ fontSize: 9, color: "#999", marginTop: 8, textAlign: "center" }}>Paiement enregistré manuellement. Montants en francs CFA.</p>
    </div>
  );
}

export function InvoiceDoc({ invoice, patient, settings }: { invoice: Invoice; patient?: Patient; settings: Settings }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Letterhead s={settings} kind="Facture" number={invoice.number} date={fDate(invoice.createdAt)} />
      <div style={{ fontSize: 12, marginBottom: 14 }}>
        <div style={{ color: "#666" }}>Facturé à</div>
        <b>{fullName(patient)}</b> {patient && `· ${patient.number}`}
        {patient?.phone && <div>{patient.phone}</div>}
        <div style={{ marginTop: 4 }}>Prestation : {invoice.service}</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f3efe6" }}>
            <th style={{ ...cell, textAlign: "left" }}>Désignation</th>
            <th style={{ ...cell, textAlign: "right" }}>Qté</th>
            <th style={{ ...cell, textAlign: "right" }}>Prix unitaire</th>
            <th style={{ ...cell, textAlign: "right" }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}>{l.label}</td>
              <td style={right}>{l.quantity}</td>
              <td style={right}>{num(l.unitPrice)}</td>
              <td style={right}>{num(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
          <tr><td colSpan={3} style={{ ...cell, fontWeight: 700 }}>Total</td><td style={{ ...right, fontWeight: 700 }}>{fcfa(invoice.total)}</td></tr>
          <tr><td colSpan={3} style={cell}>Déjà payé</td><td style={right}>{fcfa(invoice.paid)}</td></tr>
          <tr><td colSpan={3} style={{ ...cell, fontWeight: 700 }}>Reste à payer</td><td style={{ ...right, fontWeight: 700 }}>{fcfa(Math.max(0, invoice.total - invoice.paid))}</td></tr>
        </tbody>
      </table>
      <Signatures left="Cachet de la clinique" rightLabel="Signature" />
      {settings.receiptFooter && <p style={{ fontSize: 10, color: "#666", marginTop: 24, textAlign: "center" }}>{settings.receiptFooter}</p>}
    </div>
  );
}

export function PrescriptionDoc({ visit, patient, settings }: { visit: Visit; patient?: Patient; settings: Settings }) {
  const a = patient ? age(patient.birthDate) : null;
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Letterhead s={settings} kind="Ordonnance" number={visit.practitioner} date={fDate(visit.scheduledAt)} />
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        <b>{fullName(patient)}</b>
        {a !== null && ` · ${a} ans`} {patient && ` · ${patient.sex === "F" ? "Femme" : "Homme"}`}
        {patient?.allergies && <div style={{ color: "#b3261e", marginTop: 4 }}>Allergies : {patient.allergies}</div>}
      </div>
      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7, minHeight: 280, borderLeft: "3px solid #f2a93b", paddingLeft: 14 }}>
        {visit.prescription || "—"}
      </div>
      <Signatures left="" rightLabel={`Signature et cachet — ${visit.practitioner}`} />
    </div>
  );
}
