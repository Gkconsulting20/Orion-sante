import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// No credentials: exercises an isolated anonymous demo, never a real clinic.
// Leaves the synthetic records in that demo for inspection, with no deletion.
export async function smoke(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  let cookie = "";
  async function api(path, body, expected = 200) {
    const response = await fetcher(new URL(`/api${path}`, base), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: base.origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    assert.equal(response.status, expected, `${path}: expected ${expected}, got ${response.status}`);
    if (path !== "/__not_found") assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    if (expected === 404) return;
    return response.json();
  }
  assert.equal((await api("/healthz")).status, "ok");
  const start = await api("/workspace");
  assert.equal(start.isDemo, true, "Refusing to write outside anonymous demonstration");
  const patient = await api("/patients", {
    firstName: "Test", lastName: `Cloudflare-${randomUUID().slice(0, 8)}`,
    sex: "F", birthDate: "1990-01-01", phone: "", address: "",
    emergencyContact: "", allergies: "",
  }, 201);
  const invoice = await api("/invoices", {
    patientId: patient.id, service: "Test de prévisualisation",
    lines: [{ label: "Acte fictif", quantity: 1, unitPrice: 1500 }],
  }, 201);
  assert.equal(invoice.total, 1500);
  const input = {
    invoiceId: invoice.id, amount: 1500, method: "bank",
    reference: "TEST FICTIF — aucun transfert bancaire",
    requestId: randomUUID(),
  };
  const payment = await api("/payments", input, 201);
  assert.match(payment.receiptNumber, /^REC-/);
  assert.equal((await api("/payments", input, 201)).id, payment.id, "Idempotence");
  await api("/payments", { ...input, amount: 1, requestId: randomUUID() }, 400);
  const after = await api("/workspace");
  const savedInvoice = after.invoices.find((item) => item.id === invoice.id);
  assert.equal(savedInvoice.status, "paid");
  assert.equal(savedInvoice.paid, 1500);
  assert.equal(after.payments.filter((item) => item.invoiceId === invoice.id).length, 1);
  assert.ok(after.patients.some((item) => item.id === patient.id));
  assert.ok(after.payments.some((item) => item.receiptNumber === payment.receiptNumber));
  await api("/__not_found", undefined, 404);
  console.info("PASS: patient → invoice → payment → persisted receipt; idempotence and overpayment protection.");
}

if (process.argv[1]?.endsWith("/smoke.mjs")) {
  if (!process.env.ORION_PREVIEW_URL || process.env.ORION_SMOKE_APPROVED !== "yes") {
    console.error("Set ORION_PREVIEW_URL and ORION_SMOKE_APPROVED=yes for a NON-PRODUCTION target. Writes synthetic demo records only.");
    process.exit(1);
  }
  const target = new URL(process.env.ORION_PREVIEW_URL);
  if (target.hostname === "sante.comptaorion.com") throw new Error("Production target refused.");
  await smoke(target.href);
}
