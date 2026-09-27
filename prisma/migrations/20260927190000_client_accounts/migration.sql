-- The client's own accounts, replacing the published demo logins.
--
-- Until now the sign-in screen listed four credentials so the client could
-- switch roles, which meant anyone with the URL was one click from Admin. With
-- real people on the system that made the role enforcement decorative, so the
-- list is gone and these four accounts replace it.
--
-- The hashes below are bcrypt at cost 12. The passwords themselves were
-- generated once, handed over out of band, and are not in this repository. Each
-- person can change their own from the app.
--
-- The demo accounts are DEACTIVATED, not deleted: they are the actor on every
-- existing status change, payment and quote, and deleting them would orphan that
-- history. Deactivated means they cannot sign in and round-robin will not hand
-- them work.

INSERT INTO "staff" ("id","name","role","email","passwordHash","active","orderCount","sortOrder")
VALUES ('mattia', 'Mattia Paradiso', 'Admin', 'mattia@paradisoauthenticitalian.com', '$2b$12$HFMo5Aj0foTuk3RGVazppO7FOoEZzKjMsFXrrq3JBoYACHO4TFj2a', true, 0, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "role" = EXCLUDED."role", "email" = EXCLUDED."email",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "staff" ("id","name","role","email","passwordHash","active","orderCount","sortOrder")
VALUES ('marco', 'Marco Paradiso', 'Manager', 'marco@paradisoauthenticitalian.com', '$2b$12$ZGdN26x/xXOKuVqmQQa6JO/WHBP.JInWekS2dUOOT4r0S.ery7sum', true, 0, 1)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "role" = EXCLUDED."role", "email" = EXCLUDED."email",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "staff" ("id","name","role","email","passwordHash","active","orderCount","sortOrder")
VALUES ('kitchen', 'Kitchen', 'Kitchen', 'kitchen@paradisoauthenticitalian.com', '$2b$12$rcPrrbyNg4leIpxi6sX01esQa6BWpblv7ed6GSkJbt4VOrJXQ1uVm', true, 0, 2)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "role" = EXCLUDED."role", "email" = EXCLUDED."email",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "staff" ("id","name","role","email","passwordHash","active","orderCount","sortOrder")
VALUES ('shopfloor', 'Shop floor', 'Shop-floor', 'shopfloor@paradisoauthenticitalian.com', '$2b$12$KeWM/sbjiokqPeDsovF2b.bRpc0/tS1PO4cfy4xg8NTPO6hmEYOnW', true, 0, 3)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "role" = EXCLUDED."role", "email" = EXCLUDED."email",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";

-- Only the seeded demo four. Named explicitly so this cannot sweep up a real
-- account someone adds later.
UPDATE "staff" SET "active" = false
 WHERE "id" IN ('aisha', 'tom', 'marco', 'nadia');
