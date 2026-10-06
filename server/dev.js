import "dotenv/config";
import http from "node:http";
import handler from "./app.js";
const server = http.createServer(handler);
server.listen(Number(process.env.API_PORT || 3001), "127.0.0.1", () =>
  console.log(
    "Parkwise API ready on http://127.0.0.1:" + (process.env.API_PORT || 3001),
  ),
);

async function shutdown() {
  server.close(async () => {
    try {
      const { database } = await import("./database.js");
      await (await database()).close();
    } finally {
      process.exit(0);
    }
  });
  server.closeIdleConnections();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
