import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core"

export const modules = pgTable("modules", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  format: text("format").notNull(),
  manifest: jsonb("manifest").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})
