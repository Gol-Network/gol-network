/**
 * Spec-named entry point for the live allowed/refused acceptance run.
 *
 * The implementation lives in ./demo.ts. It submits one allowed 40 USDC payment and one over-budget
 * 70 USDC payment against a fresh 100/100 mandate, waits for the durable journal and The Graph, and
 * prints public identifiers, transaction hashes, outcomes, and a grounded answer as JSON evidence.
 * It is provider-neutral: the same run exercises the AWS KMS signer through the HTTP API.
 *
 * Run: pnpm demo:acceptance
 */
import './demo.js';
