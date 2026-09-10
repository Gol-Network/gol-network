# AG-UI and LangGraph agent completion specification

Status: implemented locally on 10 September 2026. This product decision supersedes the earlier
hackathon documents that excluded MCP from the original narrow submission scope; those historical
documents remain unchanged as records of the earlier decision.

## Runtime topology

1. `AgentChat` uses the official AG-UI TypeScript `HttpAgent`.
2. `/api/agent/run` validates the AG-UI envelope, enforces a 64 KB request limit, and streams the
   upstream SSE body without buffering.
3. `langgraph-agent` is a separate FastAPI process exposing `/agent` and `/health`.
4. The LangGraph process discovers the 40 allowlisted Aave MCP tools and their current JSON schemas
   at startup. Discovery failure makes production readiness fail closed.
5. The graph exposes those 40 tools plus 12 GOL client-handoff tools. Model-driven runs may iterate
   across tool results until a final response is produced.

## Human-in-the-loop boundaries

- A GOL tool never signs, submits, or mutates account state inside LangGraph. It returns a
  `client_handoff` that opens the existing owner-facing review surface.
- Payments retain the original resolution, explicit submission, durable journal, restricted signer,
  receipt reconciliation, and contract-policy flow.
- Aave read and simulation calls may execute without a wallet signature.
- Aave preparation calls return unsigned transaction requests. The browser validates supported
  chain, address, calldata and value shapes, then shows the exact sender, destination, chain, native
  value, calldata and operation labels.
- The wallet is invoked only after explicit owner confirmation. The connected address must match the
  prepared `from` address. An approval-required result submits only its approval transaction; the
  owner must ask the agent to rebuild the dependent action after that receipt.
- `submit_signed_order` and `cancel_order` are blocked from the anonymous agent path.

## Streaming UX

Each run renders incremental assistant text and a persistent ordered tool trace. Tool rows carry the
Aave or GOL icon and an explicit Running, Complete, or Failed label. The Stop control aborts the HTTP
run. A tool result renders in its protocol-specific card, while GOL payment, indexed evidence and
owner transaction states continue to use their dedicated UI.

## Acceptance evidence

- Python tests cover the 52-name catalog, GOL natural-language routing, AG-UI event sequences,
  internal authentication, signed-relay blocking, model/tool iteration, and live-schema application.
- Web unit tests cover the AG-UI proxy, body limits, prepared-transaction parsing, wallet matching,
  and receipt completion.
- Playwright starts both servers and covers a live Aave MCP result, a GOL owner handoff, prepared
  Aave transaction review/signing in fixture mode, and the complete 40/70 GOL payment scenario.
