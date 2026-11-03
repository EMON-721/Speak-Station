-- Keep existing Google accounts and previously allocated member numbers unchanged.
ALTER TABLE email_accounts ADD COLUMN login_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_login_id_unique ON email_accounts(login_id);
--> statement-breakpoint
-- New signups receive 9057 or higher. Do not renumber existing profiles.
UPDATE sqlite_sequence SET seq=MAX(seq,9056) WHERE name='member_numbers';
--> statement-breakpoint
INSERT INTO sqlite_sequence(name,seq) SELECT 'member_numbers',9056 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='member_numbers');
