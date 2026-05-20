import * as dotenv from "dotenv";
import * as path from "path";

// Load workspace .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { app } from "./app";

const start = async () => {
  try {
    const port = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;
    await app.listen({ port });
    console.log(`API listening on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
start();
