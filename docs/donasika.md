# Donasika · independent community fundraising

Public page: `/donasika`. The new campaign ledger uses `donasika_campaigns` and
`donasika_payments` in the existing `PM_DB` D1 binding. App donations and PM
purchases are not included. Payment uses the existing private `MYPG_API_KEY`.

## Activation and closing

Apply migrations with `npx wrangler d1 migrations apply PM_DB --remote`.
The campaign starts inactive. Activate once after deployment:

```sql
UPDATE donasika_campaigns
SET starts_at=unixepoch(),ends_at=unixepoch()+604800,enabled=1
WHERE id='karhutla-2026' AND starts_at IS NULL;
```

Repeated migrations/deployments/activation do not reset the deadline. The API
rejects new invoices at the deadline, independently of browser clocks. Existing
unpaid QRIS images are hidden at closing; the existing two-minute cron checks
and requests cancellation of outstanding invoices. Provider cancellation may
take a cron cycle or longer if its API is unavailable; payments completed before
cancellation are still reconciled honestly, not silently discarded.

## Automatic confirmation

- The donor browser checks status every 15 seconds. A D1 lease and `next_check`
  suppress duplicate checks across tabs and cron.
- The existing cron reconciles up to 10 pending invoices per run even when all
  donor browsers are closed. Under backlog, confirmation may take multiple runs.
- Only a server-to-server `SUCCESS` with matching transaction ID and exact billed
  amount is counted. Browser callbacks and claimed transfers cannot confirm it.
- Amounts are integer rupiah, Rp1,000–Rp1,000,000. The public total sums the
  original donation amount, excluding gateway rounding/adjustment. It is shown
  before any gateway deductions, not as an audited net payout.
- One active invoice per browser/campaign, idempotency keys, origin checks,
  same-site HttpOnly cookies and IP/session rate limits protect creation.
- Ambiguous create failures use `REVIEW` and do not auto-create replacement
  invoices. These require owner investigation using the stored reference ID.

## Public identity and recipient policy

Anonymous donations store no donor name. Only paid names/messages/amounts/times
appear publicly; private invoice IDs and transaction IDs do not. Messages are
plain text rendered through React escaping, not HTML.

The final confirmed campaign total determines the recipient: at least Rp100,000
to Save the Children Indonesia; below that to Dompet Dhuafa for karhutla. These
are owner-selected destinations, not claims of formal partnership. No automatic
transfer to either charity is implemented. The owner must perform disbursement,
publish evidence and update the page's disbursement information afterwards.

Official references:
- https://support.savethechildren.or.id/donasi-karhutla
- https://digital.dompetdhuafa.org/donasi/karhutla

## Routes

- `GET /api/donasika`: totals, campaign window and the 40 latest paid messages.
- `POST /api/donasika/payments`: `{amount,name,anonymous,message,request_key}`.
- `GET /api/donasika/payments/:id`: invoice bound to its browser cookie.

Load the summary first to establish the cookie. QRIS URLs are returned only for
pending payments while the campaign is open. Total donor amounts update on the
page every 15 seconds, and after payment confirmation.

Validation: `node --test tests/donasika.test.mjs`, `npm run typecheck`,
`npm run build` and responsive browser checks.
