BEGIN;

CREATE TABLE IF NOT EXISTS account_links (
  user_subject text PRIMARY KEY,
  owner_address char(42) NOT NULL UNIQUE,
  account_address char(42) NOT NULL UNIQUE,
  agent_wallet_id text,
  agent_address char(42) NOT NULL,
  policy_id text,
  policy_version varchar(16),
  signer_provider varchar(32) NOT NULL DEFAULT 'privy',
  signer_key_arn text,
  signer_region varchar(32),
  signer_address char(42),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipients (
  account_address char(42) NOT NULL REFERENCES account_links(account_address) ON DELETE CASCADE,
  address char(42) NOT NULL,
  label varchar(100) NOT NULL,
  confirmed_at timestamptz,
  PRIMARY KEY (account_address, address),
  UNIQUE (account_address, label)
);

ALTER TABLE recipients ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY,
  user_subject text NOT NULL REFERENCES account_links(user_subject) ON DELETE CASCADE,
  account_address char(42) NOT NULL REFERENCES account_links(account_address) ON DELETE CASCADE,
  mandate_id numeric(78, 0) NOT NULL CHECK (mandate_id > 0),
  request_id char(66) NOT NULL,
  input_hash char(64) NOT NULL,
  text varchar(2000) NOT NULL,
  parsed_recipient char(42),
  parsed_amount numeric(78, 0),
  state varchar(32) NOT NULL,
  provider_operation_id text,
  tx_hash char(66),
  tx_nonce numeric(78, 0),
  receipt_block numeric(78, 0),
  receipt_hash char(66),
  rule varchar(64),
  attempted_units numeric(78, 0),
  headroom_units numeric(78, 0),
  error_code varchar(100),
  unsigned_intent_hash char(66),
  signed_raw_transaction text,
  signing_key_arn text,
  signed_at timestamptz,
  broadcast_attempted_at timestamptz,
  last_broadcast_error varchar(100),
  lease_owner text,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_address, mandate_id, request_id)
);

CREATE INDEX IF NOT EXISTS requests_claim_idx ON requests (state, lease_until, created_at);
CREATE INDEX IF NOT EXISTS requests_user_idx ON requests (user_subject, created_at DESC);

CREATE TABLE IF NOT EXISTS request_transactions (
  request_row_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  tx_hash char(66) NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_row_id, tx_hash)
);

-- ---------------------------------------------------------------------------------------------------
-- Additive, reversible migrations. Every statement is idempotent so the whole file re-runs safely
-- against an existing database before the application readers change.
-- ---------------------------------------------------------------------------------------------------

-- Provider-neutral signer columns on account_links. Historical Privy identifiers stay nullable.
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS agent_wallet_id text;
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS policy_id text;
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS policy_version varchar(16);
ALTER TABLE account_links ALTER COLUMN agent_wallet_id DROP NOT NULL;
ALTER TABLE account_links ALTER COLUMN policy_id DROP NOT NULL;
ALTER TABLE account_links
  ADD COLUMN IF NOT EXISTS signer_provider varchar(32) NOT NULL DEFAULT 'privy';
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS signer_key_arn text;
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS signer_region varchar(32);
ALTER TABLE account_links ADD COLUMN IF NOT EXISTS signer_address char(42);

ALTER TABLE account_links DROP CONSTRAINT IF EXISTS account_links_signer_provider_check;
ALTER TABLE account_links
  ADD CONSTRAINT account_links_signer_provider_check
  CHECK (signer_provider IN ('privy', 'aws_kms'));

-- A KMS-backed link must carry a key ARN, region, and derived address.
ALTER TABLE account_links DROP CONSTRAINT IF EXISTS account_links_kms_complete_check;
ALTER TABLE account_links
  ADD CONSTRAINT account_links_kms_complete_check
  CHECK (
    signer_provider <> 'aws_kms'
    OR (signer_key_arn IS NOT NULL AND signer_region IS NOT NULL AND signer_address IS NOT NULL)
  );

-- Durable KMS construction/signing/broadcast recovery fields on requests.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS unsigned_intent_hash char(66);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS signed_raw_transaction text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS signing_key_arn text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS broadcast_attempted_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS last_broadcast_error varchar(100);

-- State machine values. `signing_prepared` holds a parsed intent and a locked nonce; `signed` holds
-- the exact raw transaction and its local hash.
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_state_check;
ALTER TABLE requests
  ADD CONSTRAINT requests_state_check
  CHECK (state IN (
    'queued', 'needs_clarification', 'signing', 'signing_prepared', 'signed', 'submitted',
    'pending', 'executed', 'refused', 'signer_blocked', 'technical_failure', 'unknown'
  ));

COMMIT;
