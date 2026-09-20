/**
 * GET /api/rapid/return
 *
 * The redirect URL Rapid sends the customer back to after they finish (or abandon)
 * the hosted checkout page. We persist the query string for debugging, then send
 * the customer to the home page where the order table will reflect the latest
 * status (which may have been updated by the webhook moments earlier).
 *
 * This route does NOT trust the query string for state changes — only the signed
 * webhook can mutate order status. The query string is informational only.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mRef = url.searchParams.get("mRef");
  const status = url.searchParams.get("status");
  const txnRef = url.searchParams.get("gatewayTxnRef") || url.searchParams.get("txnRef");

  if (mRef) {
    try {
      const order = await db.order.findUnique({
        where: { merchantTransactionId: mRef },
      });
      if (order) {
        await db.order.update({
          where: { id: order.id },
          data: {
            // Persist the full query string for debugging — does NOT change status.
            redirectPayload: url.search.slice(1),
            gatewayTxnRef: txnRef ?? order.gatewayTxnRef,
          },
        });
      }
    } catch (err) {
      console.error("[rapid/return] DB update failed", err);
    }
  }

  // Send the user home with a lightweight status hint in the URL hash.
  const home = new URL("/", url.origin);
  if (mRef) home.searchParams.set("order", mRef);
  if (status) home.searchParams.set("status", status);
  return NextResponse.redirect(home);
}
