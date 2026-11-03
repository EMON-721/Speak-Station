-- Additional email/password accounts, separated from verified Google identities.
CREATE TABLE IF NOT EXISTS email_accounts (
 email TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS email_auth_limits (
 key TEXT PRIMARY KEY NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 reset_at INTEGER NOT NULL
);
--> statement-breakpoint
-- Preserve all previously issued member numbers. New numbers begin at 57 or later.
UPDATE sqlite_sequence SET seq=MAX(seq,56) WHERE name='member_numbers';
--> statement-breakpoint
INSERT INTO sqlite_sequence(name,seq) SELECT 'member_numbers',56 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='member_numbers');
