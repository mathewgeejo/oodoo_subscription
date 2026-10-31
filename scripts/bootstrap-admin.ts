import "dotenv/config";
import { db } from "../src/server/db";
import { provisionUser } from "../src/server/auth/provision";
async function main() {
  await provisionUser({name: process.env.ADMIN_NAME ?? "Administrator", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD});
  console.log("Administrator created. Remove ADMIN_PASSWORD from your environment.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; }).finally(() => db.$disconnect());
