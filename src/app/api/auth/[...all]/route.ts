import { getAuth } from "../../../../server/auth/config";
export const runtime = "nodejs";
export function GET(request: Request) { return getAuth().handler(request); }
export function POST(request: Request) { return getAuth().handler(request); }
