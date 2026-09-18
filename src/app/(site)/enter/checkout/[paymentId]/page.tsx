import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { prisma } from "@/lib/db";
import { isDevPayments } from "@/lib/payments";
import { formatMoney } from "@/lib/format";
import { hasCheckoutCapability } from "@/lib/payments/access";
import { simulatePaymentAction } from "./actions";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Stand-in for a provider's hosted checkout while PAYMENT_PROVIDER is "dev".
 * It never touches money; it lets the entry flow be driven end to end before a
 * real provider is connected in Phase 11.
 *
 * Access needs no account: the browser that started this checkout holds a
 * capability cookie naming the payment. An administrator can also open it.
 */
export default async function CheckoutPage(props: PageProps<"/enter/checkout/[paymentId]">) {
  const { paymentId } = await props.params;
  if (!isDevPayments()) notFound();
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(paymentId)) notFound();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      season: { select: { name: true } },
      entry: { select: { product: { select: { name: true } } } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!payment) notFound();

  const store = await cookies();
  const holdsCookie = hasCheckoutCapability(store.get(PENDING_PAYMENT_COOKIE)?.value, payment);
  const user = await getSessionUser();
  const isOwner = user?.id === payment.userId;
  if (!holdsCookie && !isOwner) notFound();

  if (payment.status === "SUCCEEDED") redirect("/dashboard?entered=1");

  const params = await props.searchParams;
  const failed = params.failed === "1";
  const unavailable = params.unavailable === "1";

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-12 pb-4">
      <Panel className="p-6">
        <div className="label text-rising">Test checkout &mdash; no money moves</div>

        <h1 className="mt-3 text-xl font-semibold">
          {payment.entry?.product.name ?? "Season entry"}
        </h1>
        <p className="text-subtle mt-1 text-[13px]">
          {payment.season.name} entry &middot; entry for {payment.user.email}
        </p>

        {unavailable && <p role="alert" className="text-danger mt-4 text-sm">This entry can no longer be paid. Registration may have closed or the season is full. No money was charged.</p>}
        {failed ? (
          <div className="border-danger/25 bg-danger/8 text-danger mt-4 rounded-md border px-3.5 py-2.5 text-[13px]">
            Simulated decline. You can retry the test payment.
          </div>
        ) : null}

        <div className="border-border mt-5 flex items-baseline justify-between border-t pt-5">
          <span className="label">Amount due</span>
          <span className="num text-2xl font-semibold">
            {formatMoney(payment.amountCents, payment.currency)}
          </span>
        </div>

        <div className="mt-6 space-y-2">
          <form action={simulatePaymentAction}>
            <input type="hidden" name="paymentId" value={payment.id} />
            <input type="hidden" name="outcome" value="succeeded" />
            <SubmitButton variant="primary" size="lg" className="w-full" pendingLabel="Taking payment…">
              Simulate successful payment
            </SubmitButton>
          </form>

          <form action={simulatePaymentAction}>
            <input type="hidden" name="paymentId" value={payment.id} />
            <input type="hidden" name="outcome" value="failed" />
            <SubmitButton variant="secondary" size="md" className="w-full" pendingLabel="Working…">
              Simulate a declined card
            </SubmitButton>
          </form>
        </div>

        <p className="text-faint mt-5 text-center text-[12px] leading-relaxed">
          This is a simulated checkout. No card details are collected and no receipt email is sent.
        </p>

        <div className="mt-4 text-center">
          <ButtonLink href="/enter" variant="ghost" size="sm">
            Cancel
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
