import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// One owner-isolated aggregate; all financial writes hold a row lock so
// simultaneous payments cannot overpay an invoice or duplicate a receipt.
export const clinicsTable = pgTable("clinics", {
  owner: text("owner").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
