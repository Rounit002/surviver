import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CAMPAIGN_TOKEN_COOKIE, PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";

/**
 * Where the payment provider returns the founder after checkout.
 *
 * The private campaign capability deliberately does not appear in this URL. A
 * return URL is handed to the provider, written into its dashboards and logs,
 * and often passed through analytics, so putting the capability there would
 * leak permanent access to the campaign. Instead the capability was left in an
 * HttpOnly cookie on this browser when the checkout started, and is only turned
 * back into a URL here, on our own origin.
 *
 * Returning here is not proof of payment. It only decides where to send the
 * browser; the entry itself is settled by the signed provider webhook.
 */
export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get(CAMPAIGN_TOKEN_COOKIE)?.value;

  // The checkout is over either way, so the capability cookie has done its job.
  const response = /^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")
    ? NextResponse.redirect(new URL(`/entry/${token}`, request.url))
    : NextResponse.redirect(new URL("/dashboard?entered=1", request.url));

  response.cookies.delete(CAMPAIGN_TOKEN_COOKIE);
  response.cookies.delete(PENDING_PAYMENT_COOKIE);
  return response;
}
