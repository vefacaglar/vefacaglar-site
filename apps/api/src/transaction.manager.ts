import { injectable, inject } from "tsyringe";
import type { DbType } from "@vefacaglar/db";
import { DB_CONNECTION, transactionStorage } from "./db.tokens";

@injectable()
export class TransactionManager {
  constructor(@inject(DB_CONNECTION) private readonly db: DbType) {}

  async run<T>(callback: () => Promise<T>): Promise<T> {
    const activeTx = transactionStorage.getStore();
    if (activeTx) {
      return await callback();
    }

    return await this.db.transaction(async (tx) => {
      return await transactionStorage.run(tx, callback);
    });
  }
}
