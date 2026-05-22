import { AsyncLocalStorage } from "async_hooks";
import type { DbType } from "@vefacaglar/db";

export const DB_CONNECTION = Symbol("DbConnection");

export type TransactionClient = Parameters<Parameters<DbType["transaction"]>[0]>[0];
export type DbOrTx = DbType | TransactionClient;

export const transactionStorage = new AsyncLocalStorage<DbOrTx>();


