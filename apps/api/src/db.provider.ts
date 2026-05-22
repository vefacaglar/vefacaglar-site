import { injectable, inject } from "tsyringe";
import type { DbType } from "@vefacaglar/db";
import { DB_CONNECTION, DbOrTx, transactionStorage } from "./db.tokens";

@injectable()
export class DbProvider {
  constructor(@inject(DB_CONNECTION) private readonly defaultDb: DbType) {}

  get client(): DbOrTx {
    return transactionStorage.getStore() ?? this.defaultDb;
  }

  async transaction<T>(callback: (tx: DbOrTx) => Promise<T>): Promise<T> {
    const activeTx = transactionStorage.getStore();
    if (activeTx) {
      return await callback(activeTx);
    }
    return await this.defaultDb.transaction(async (tx) => {
      return await transactionStorage.run(tx, () => callback(tx));
    });
  }
}
