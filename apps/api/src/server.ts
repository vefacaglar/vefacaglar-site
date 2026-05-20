import { app } from "./app";

const start = async () => {
  try {
    await app.listen({ port: 3001 });
    console.log("API listening on http://localhost:3001");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
start();
