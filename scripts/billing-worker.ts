import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import { db } from "../src/server/db";
import { runBillingBatch } from "../src/server/billing/worker";
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL before starting the worker");
  while (!controller.signal.aborted) {
    try { console.log(JSON.stringify(await runBillingBatch())); }
    catch { console.error("Billing batch failed; retrying on the next poll"); }
    try { await setTimeout(5000, undefined, {signal: controller.signal}); } catch { break; }
  }
}
main().catch(error => {console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1;}).finally(() => db.$disconnect());
