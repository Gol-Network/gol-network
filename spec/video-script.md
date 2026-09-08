# GOL demo video script

Target duration: 3 minutes 30 seconds. Human narration only. Record the live deployment and real transactions. Do not present fixture screenshots as live evidence.

## 0:00 to 0:15 - Product

Show the GOL page and account header.

Narration: "GOL lets a business owner give an AI operations agent a precise USDC budget without giving the model open-ended wallet authority. Today the agent can pay one approved design contractor on Arc testnet."

## 0:15 to 0:50 - Owner control

Sign in with Privy. Show the separate owner and agent addresses. Review the mandate before signing: 100 USDC per payment, 100 USDC cumulative, one recipient, seven-day expiry. Show 100 USDC funded.

Narration: "The owner signs account funding and this mandate directly. The backend has no owner signing credential. Privy gives the separate agent wallet a signer restricted to this chain, this account, and zero native value. The Solidity account independently controls recipients and budget."

## 0:50 to 1:20 - Allowed payment

Submit "Pay 40 USDC to Design contractor." Show the durable states, finalized receipt, indexed `EXECUTED` row, and 60 USDC remaining.

Narration: "The model returns only a typed recipient and amount. The worker supplies the random request ID and verified account context. The contract transfers 40 USDC, records the result, and leaves 60 USDC of cumulative headroom."

## 1:20 to 2:00 - Refused payment

Submit "Pay 70 USDC to Design contractor." Show a successful transaction receipt with a `REFUSED` outcome and no second transfer.

Narration: "This valid agent call reaches the contract, but 70 is greater than the 60 remaining. The contract returns normally so the refusal persists on-chain. A successful receipt here means the refusal was recorded, not that the contractor was paid."

## 2:00 to 2:25 - Graph evidence

Open the refusal in the explorer and show the real Graph provider response with attempted amount, headroom, rule, transaction hash, indexed block, and deployment ID.

Narration: "The Graph indexes both outcomes. This refusal reports 70 attempted, 60 remaining, an unchanged spent total, and the same Arc transaction reference."

## 2:25 to 3:00 - Grounded answer

Ask, "Why was the 70 USDC payment refused?" Follow its explorer citation.

Narration: "The answer starts from scoped indexed records, not model memory. The application constructs citations from those records and reports if indexing is stale, partial, empty, or unavailable. The question route cannot sign."

## 3:00 to 3:30 - Boundaries and close

Show the architecture image, wrong-destination Privy denial, and owner revoke confirmation without completing an unnecessary revoke before the recording ends.

Narration: "Privy limits the signing envelope, GolAccount is the final spending authority, and The Graph makes each outcome inspectable. The owner can revoke on-chain at any time. GOL is an Arc testnet prototype for controlled contractor payments, not an audited mainnet product."

## Recording checks

- 720p or higher, normal speed, audible human narration, no synthesized voice
- no secret values, wallet exports, email addresses, browser tokens, or Graph API keys on screen
- real event ordering preserved if indexing wait is edited out
- 2 to 4 minutes after export, correct form-compatible container and codec
- final video watched once from start to finish before upload
