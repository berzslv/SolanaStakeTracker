import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const stakingTransactions = pgTable("staking_transactions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  amount: text("amount").notNull(),
  transactionType: text("transaction_type").notNull(), // 'stake' or 'unstake'
  transactionSignature: text("transaction_signature").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStakingTransactionSchema = createInsertSchema(stakingTransactions).pick({
  walletAddress: true,
  amount: true,
  transactionType: true,
  transactionSignature: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStakingTransaction = z.infer<typeof insertStakingTransactionSchema>;
export type StakingTransaction = typeof stakingTransactions.$inferSelect;
