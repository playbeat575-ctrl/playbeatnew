/**
 * POST /api/rapid/create-session
 *
 * Body: { amount: number, currency?: "PKR", email, name?, phone?, description? }
 *
 * Creates an Order row in our DB, then calls Rapid's hosted-checkout endpoint
 * and returns the checkout URL the browser should redirect to.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rapidConfig, rapidOutboundReady, assertRapidConfigured } from "@/lib/rapid/config";
import { createHostedCheckout } from "@/lib/rapid/client";
import { decimalToMinor } from "@/lib/rapid/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateSessionBody {
  amount?: number;
  currency?: string;
  email?: string;
  name?: string;
  phone?: string;
  description?: string;
}

export async function POST(req: Request) {
  if (!rapidOutboundReady()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Rapid Gateway is not configured. Set RAPID_GATEWAY_MERCHANT_ID and RAPID_GATEWAY_API_KEY in .env",
      },
      { status: 503 },
    );
  }
  assertRapidConfigured();

  let body: CreateSessionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount must be a positive number" }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return NextResponse.json({ ok: false, error: "amount exceeds 1,000,000 PKR limit" }, { status: 400 });
  }
  if (!body.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return NextResponse.json({ ok: false, error: "email is required and must be valid" }, { status: 400 });
  }

  const currency = (body.currency ?? "PKR").toUpperCase();
  const amountMinor = decimalToMinor(amount, currency);

  // Create the order first — guarantees a merchantTransactionId even if Rapid is slow.
  const order = await db.order.create({
    data: {
      merchantTransactionId: "", // placeholder, set below
      amountMinor,
      currency,
      customerEmail: body.email.trim().toLowerCase(),
      customerName: body.name?.trim() || null,
      customerPhone: body.phone?.trim() || null,
      description: body.description?.trim() || null,
      status: "PENDING",
      environment: rapidConfig.environment.toUpperCase(),
    },
  });

  // Use a short, readable merchantTransactionId (Rapid limits length — keep <= 40 chars).
  const mRef = `ORDER-${order.id.slice(-12).toUpperCase()}`;
  await db.order.update({ where: { id: order.id }, data: { merchantTransactionId: mRef } });

  try {
    const checkout = await createHostedCheckout({
      merchantTransactionId: mRef,
      amount,
      currency,
      customerEmail: body.email.trim().toLowerCase(),
      customerName: body.name?.trim(),
      customerPhone: body.phone?.trim(),
      description: body.description?.trim(),
    });

    if (!checkout.checkoutUrl) {
      // Mark the order as failed so it shows up in the dashboard, but return the raw
      // response so the merchant can debug shape mismatches.
      await db.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Rapid did not return a checkoutUrl. Check server logs — the response shape may differ.",
          orderId: order.id,
          raw: checkout.raw,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      merchantTransactionId: mRef,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (err) {
    console.error("[rapid/create-session] error", err);
    await db.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error calling Rapid",
        orderId: order.id,
      },
      { status: 502 },
    );
  }
}
