-- Fix the Manager account, which the previous migration switched off.
--
-- It gave Marco Paradiso the id 'marco', which already belonged to the seeded
-- Kitchen demo account. The INSERT therefore became an ON CONFLICT UPDATE of
-- that row, and the deactivation list a few lines later — which names 'marco' —
-- switched off the account it had just created. Locally the seed rebuilds staff
-- from INITIAL_STAFF, where the id is 'marco-paradiso', so nothing showed up
-- until the four accounts were tried against live.
--
-- The same collision left a published demo password on a Manager account: the
-- ON CONFLICT clause deliberately does not touch passwordHash, so the row kept
-- the old 'kitchen-demo' hash. That is corrected here, not merely reactivated.
--
-- Order matters. The demo row is put back FIRST, because it is currently
-- holding marco@paradisoauthenticitalian.com and that column is unique — insert
-- the new account first and it fails on the email index, not on the id.

-- Back to what it was before that accidental update, and left deactivated. It is
-- the actor on existing production history, which should read under the name
-- that actually did the work.
UPDATE "staff"
   SET "name" = 'Marco Ferrari', "role" = 'Kitchen',
       "email" = 'marco@paradiso.test', "active" = false
 WHERE "id" = 'marco';

INSERT INTO "staff" ("id","name","role","email","passwordHash","active","orderCount","sortOrder")
VALUES ('marco-paradiso', 'Marco Paradiso', 'Manager', 'marco@paradisoauthenticitalian.com', '$2b$12$ZGdN26x/xXOKuVqmQQa6JO/WHBP.JInWekS2dUOOT4r0S.ery7sum', true, 0, 1)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "role" = EXCLUDED."role", "email" = EXCLUDED."email",
  -- Set here, unlike the general case: this account has never been used, so
  -- there is no password of anyone's to preserve.
  "passwordHash" = EXCLUDED."passwordHash",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
