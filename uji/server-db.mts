import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("PGlite siap di 127.0.0.1:5433");

process.on("SIGTERM", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
