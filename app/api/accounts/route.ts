import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/accounts";
import { getUserId } from "@/lib/auth";

/** Full account list for the signed-in user. The dashboard refetches this after a socket reconnect. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ accounts: await listAccounts(userId) });
}
