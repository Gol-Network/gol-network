BEGIN;

CREATE TABLE IF NOT EXISTS account_links (
  user_subject text PRIMARY KEY,
  owner_address char(42) NOT NULL UNIQUE,
  account_address char(42) NOT NULL UNIQUE,
  agent_wallet_id text NOT NULL,
  agent_address char(42) NOT NULL,
  policy_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipients (
  account_address char(42) NOT NULL REFERENCES account_links(account_address) ON DELETE CASCADE,
  address char(42) NOT NULL,
  label varchar(100) NOT NULL,
  PRIMARY KEY (account_address, address),
  UNIQUE (account_address, label)
);

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
  state varchar(32) NOT NULL CHECK (state IN (
    'queued', 'needs_clarification', 'signing', 'submitted', 'pending', 'executed',
    'refused', 'signer_blocked', 'technical_failure', 'unknown'
  )),
  provider_operation_id text,
  tx_hash char(66),
  tx_nonce numeric(78, 0),
  receipt_block numeric(78, 0),
  receipt_hash char(66),
  rule varchar(64),
  attempted_units numeric(78, 0),
  headroom_units numeric(78, 0),
  error_code varchar(100),
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

COMMIT;
