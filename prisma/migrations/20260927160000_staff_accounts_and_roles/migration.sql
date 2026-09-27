-- Per-user staff accounts, replacing the shared demo password.
--
-- Until now every user signed in with one shared DEMO_PASSWORD and then picked
-- which staff member to be. That was acceptable while the roles were cosmetic.
-- It is not acceptable now they are enforced: a single secret whose holder can
-- become any user, Admin included, is a master key, and no role boundary
-- survives one. The shared password is gone rather than kept as a fallback.
--
-- Each account gets an email, a bcrypt hash (cost 12) and a real role. The
-- hashes below are of DEMO credentials which are printed on the sign-in screen
-- on purpose, so the client can switch roles and see the difference. They are
-- published, so the live demo is open to anyone who reads that screen — which
-- is intended for a demo and must be changed before real use. The mechanism is
-- real; only these particular passwords are public.

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('Admin', 'Manager', 'Kitchen', 'Shop-floor');

-- AlterTable: credentials, nullable first so existing rows can be filled in
ALTER TABLE "staff" ADD COLUMN "email" TEXT;
ALTER TABLE "staff" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "staff" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff" ADD COLUMN "lastSignInAt" TIMESTAMP(3);

INSERT INTO "staff" ("id","name","role","orderCount","sortOrder","email","passwordHash","active")
VALUES ('aisha', 'Aisha Bello', 'staff', 0, 0, 'aisha@paradiso.test', '$2b$12$j4WHoERKi2QjVWwofCve5.aMy/e75dBXhw6C39jfvf8zuM9HHULK2', true)
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "active" = true;
INSERT INTO "staff" ("id","name","role","orderCount","sortOrder","email","passwordHash","active")
VALUES ('tom', 'Tom Whitfield', 'staff', 0, 1, 'tom@paradiso.test', '$2b$12$4a.Mi4fvwX0ZhPaTaYOsbeNmmU7U8FeHerjVSVZ3gmQCaDfsos3O6', true)
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "active" = true;
INSERT INTO "staff" ("id","name","role","orderCount","sortOrder","email","passwordHash","active")
VALUES ('marco', 'Marco Ferrari', 'staff', 0, 2, 'marco@paradiso.test', '$2b$12$zr4ArCz3G9uwYmK6J9oJkusTwxR6HF7G1uYK.BvQ7wjpjQRPOlg5G', true)
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "active" = true;
INSERT INTO "staff" ("id","name","role","orderCount","sortOrder","email","passwordHash","active")
VALUES ('nadia', 'Nadia Haddad', 'staff', 0, 3, 'nadia@paradiso.test', '$2b$12$kyBq80ntlmpBtlJurzEeMeALA6nwaqIOC9MbYEuD1zuaN6fAPpXqW', true)
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "active" = true;

-- Any row this migration did not name keeps working but cannot sign in until an
-- admin gives it credentials. Placeholder addresses are unique per id and the
-- hash is a value no password can produce, so the account is closed, not open.
UPDATE "staff"
   SET "email" = "id" || '@unassigned.invalid',
       "passwordHash" = '!no-password-set',
       "active" = false
 WHERE "email" IS NULL;

ALTER TABLE "staff" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "staff" ALTER COLUMN "passwordHash" SET NOT NULL;
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- Swap role from free text to the enum. The old column only ever held
-- 'admin' or 'staff'; anything else is given the least privilege rather than
-- the benefit of the doubt.
ALTER TABLE "staff" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "staff"
  ALTER COLUMN "role" TYPE "StaffRole"
  USING (CASE "role" WHEN 'admin' THEN 'Admin' ELSE 'Shop-floor' END)::"StaffRole";

-- Now set the demo roles explicitly, one per role so all four can be shown.
UPDATE "staff" SET "role" = 'Admin'::"StaffRole", "name" = 'Aisha Bello' WHERE "id" = 'aisha';
UPDATE "staff" SET "role" = 'Manager'::"StaffRole", "name" = 'Tom Whitfield' WHERE "id" = 'tom';
UPDATE "staff" SET "role" = 'Kitchen'::"StaffRole", "name" = 'Marco Ferrari' WHERE "id" = 'marco';
UPDATE "staff" SET "role" = 'Shop-floor'::"StaffRole", "name" = 'Nadia Haddad' WHERE "id" = 'nadia';
