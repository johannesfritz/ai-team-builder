# ADR-006: Payment Processing — Stripe Connect (Standard)

**Status:** Accepted
**Date:** 2026-03-28
**Decision Makers:** Solutions Architect (Claude)

---

## Institutional Memory Check

Related ADRs: None. No payment processing exists in any current project.

Consistency Analysis:
- This is the first payment system in the codebase. Establishes the pattern.

---

## Context

The marketplace enables creators to sell plugins. This requires:

| Requirement | Details |
|-------------|---------|
| **Buyer payments** | One-time purchase or subscription for paid plugins |
| **Creator payouts** | Money flows to plugin creators (minus platform fee) |
| **Platform fee** | Bot the Builder takes a percentage of each sale |
| **Multi-currency** | Users worldwide |
| **Tax compliance** | VAT, sales tax handling |
| **Refunds** | Must support refund workflow |

This is a **marketplace** payment model — Bot the Builder is the platform, not the seller. Money flows from buyer to creator via the platform.

---

## Decision

Use **Stripe Connect (Standard accounts)** for marketplace payments.

- Buyers pay via Stripe Checkout
- Creators onboard via Stripe Connect Standard (they connect their own Stripe account)
- Platform collects an application fee on each transaction
- Stripe handles payouts, tax reporting, and compliance

---

## Options Considered

### Option A: Stripe Connect (Standard) — SELECTED

**Pros:**
- Purpose-built for marketplace payments
- Standard accounts: creators manage their own Stripe dashboard (less support burden)
- Application fees: platform takes a percentage automatically
- Stripe handles KYC, tax reporting (1099s), and payouts
- Stripe Checkout: PCI-compliant payment UI with no frontend effort
- Webhook-driven: reliable event processing for fulfillment
- Global: 135+ currencies, 46+ countries

**Cons:**
- Stripe fee: 2.9% + $0.30 per transaction (plus Connect fee)
- Standard accounts require creators to have a Stripe account (onboarding friction)
- Complex webhook handling (must be idempotent, must handle retries)
- Tax compliance still requires attention (Stripe Tax is additional cost)

### Option B: Stripe Connect (Express)

**Pros:**
- Simpler creator onboarding (embedded onboarding flow)
- Platform has more control over payout schedule

**Cons:**
- More platform liability (we manage disputes)
- Higher compliance burden
- Express accounts are less flexible for creators

### Option C: Paddle / Lemon Squeezy (Merchant of Record)

**Pros:**
- Platform handles ALL tax compliance (VAT, sales tax globally)
- Simpler implementation — we are the reseller, not a marketplace
- No need for creators to have payment accounts

**Cons:**
- Higher fees (5% + $0.50 for Paddle)
- Creators cannot manage their own billing/invoicing
- Less transparent for creators (they get payouts from us, not from buyers)
- Paddle/Lemon Squeezy are not designed for marketplace payouts at scale

### Option D: Custom (direct bank transfers, crypto)

**Rejected** — regulatory and compliance burden is enormous. No team has the expertise or bandwidth to build a payment system from scratch.

---

## Consequences

### Positive

1. **Industry standard** — Stripe Connect is the default choice for marketplace payments
2. **Low platform liability** — Standard accounts mean creators handle their own disputes and compliance
3. **Global reach** — 135+ currencies, handles international payments
4. **Minimal frontend work** — Stripe Checkout provides the entire payment UI
5. **Reliable fulfillment** — webhook-driven architecture ensures payment events are processed

### Negative

1. **Creator onboarding friction** — creators must set up a Stripe account (but most developers already have one)
2. **Transaction fees** — 2.9% + $0.30 per transaction is the cost of doing business
3. **Webhook complexity** — must handle idempotency, retries, out-of-order events
4. **Stripe dependency** — deep integration, hard to switch (but Stripe is the most stable payment platform)

### Trade-off

A Merchant of Record (Paddle) would simplify tax compliance but adds friction for creators (they lose visibility into their sales). Since Bot the Builder targets developers who likely already have Stripe accounts, Connect Standard is the path of least friction.

---

## Implementation Notes

### Pricing Model (MVP)

Start simple:
- **Free plugins**: no payment involved, public GitHub repos
- **Paid plugins**: one-time purchase, Stripe Checkout
- **Platform fee**: 15% application fee (retained by Bot the Builder)

Subscriptions and usage-based pricing are deferred to post-MVP.

### Integration Architecture

```
Buyer clicks "Purchase"
  → Next.js API route creates Stripe Checkout Session
    (with application_fee_percent: 15, connected_account: creator's stripe_id)
  → Buyer completes payment on Stripe Checkout
  → Stripe sends checkout.session.completed webhook
  → Webhook handler:
    1. Records purchase in PostgreSQL
    2. Adds buyer as GitHub collaborator on private repo (ADR-004)
    3. Sends confirmation email
```

### Webhook Handling

```typescript
// app/api/webhooks/stripe/route.ts
// - Verify webhook signature (STRIPE_WEBHOOK_SECRET)
// - Idempotency: check purchase record exists before processing
// - Handle: checkout.session.completed, payment_intent.refunded
// - On refund: remove GitHub collaborator access
```

### Creator Onboarding

```
Creator clicks "Start Selling"
  → Redirect to Stripe Connect onboarding (Standard account)
  → Creator connects their Stripe account
  → Stripe redirects back with stripe_account_id
  → Store stripe_account_id in users table
  → Creator can now set prices on their plugins
```

### Deferred Decisions

- **Subscriptions**: Not for MVP. Requires subscription lifecycle management (upgrade, downgrade, cancel, grace period).
- **Usage-based pricing**: Not for MVP. Would require metering infrastructure.
- **Tax compliance**: Stripe Tax ($0.50/transaction) deferred until volume justifies it. MVP relies on creators handling their own tax obligations (Standard accounts).

---

## Related ADRs

- ADR-004: Plugin Storage (GitHub collaborator access on purchase)
- ADR-005: Authentication (user identity for purchases)
- ADR-003: Database (purchase records)
