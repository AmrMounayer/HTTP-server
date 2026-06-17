import {pgTable, uuid, varchar, timestamp, text, boolean} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    email: varchar("email", {length: 256}).unique().notNull(),
    hashedPassword: varchar("hashed_password", {length: 256}).notNull().default("unset"),
    isChirpyRed: boolean("is_chirpy_red").default(false).notNull()
});

export const chirps = pgTable("chirps", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    body: varchar("body", {length: 140}).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
});

export const refreshTokens = pgTable("refresh_tokens", {
    token: text("token").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at")
});

export type NewUser = typeof users.$inferInsert;
export type UserResponse = Omit<typeof users.$inferSelect, "hashedPassword">;
export type NewChirp = typeof chirps.$inferInsert;