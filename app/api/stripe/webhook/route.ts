import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
      return "ACTIVE" as const;
    case "trialing":
      return "TRIALING" as const;
    case "past_due":
    case "unpaid":
      return "PAST_DUE" as const;
    case "canceled":
    case "incomplete_expired":
      return "CANCELED" as const;
    default:
      return "CANCELED" as const;
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const tenantId = Number(subscription.metadata.tenantId);
  const planCode = subscription.metadata.planCode || null;

  if (!tenantId) {
    return;
  }

  const mappedStatus = mapSubscriptionStatus(subscription.status);
  const currentPeriodStart = subscription.items.data[0]?.current_period_start
    ? new Date(subscription.items.data[0].current_period_start * 1000)
    : null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { tenantId },
      data: {
        planCode,
        status: mappedStatus,
        providerCustomerId:
          typeof subscription.customer === "string" ? subscription.customer : null,
        providerSubId: subscription.id,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialStart: subscription.trial_start
          ? new Date(subscription.trial_start * 1000)
          : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: mappedStatus === "ACTIVE" || mappedStatus === "TRIALING" ? "ACTIVE" : "EXPIRED",
      },
    }),
  ]);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret mungon." }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Stripe signature mungon." }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook invalid." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = Number(session.metadata?.tenantId);
        if (tenantId) {
          await prisma.subscription.update({
            where: { tenantId },
            data: {
              providerCustomerId:
                typeof session.customer === "string" ? session.customer : null,
              providerSubId:
                typeof session.subscription === "string" ? session.subscription : null,
              planCode: session.metadata?.planCode ?? null,
            },
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { providerSubId: subscriptionId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
