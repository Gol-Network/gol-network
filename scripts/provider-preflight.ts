/**
 * Spec-named entry point for the redacted provider and KMS/Arc readiness preflight.
 *
 * The implementation lives in ./preflight.ts. It prints booleans, public identifiers, and stable
 * error codes only, and is provider-aware: with AGENT_SIGNER_PROVIDER=aws_kms it checks the KMS
 * signer configuration (ARN shape, region, derived address checksum, fee ceilings) instead of the
 * Privy authorization quorum. No `kms:Sign`, `kms:GetPublicKey`, or paid model call is issued.
 *
 * Run: pnpm provider:preflight   (alias: pnpm preflight)
 */
import './preflight.js';
