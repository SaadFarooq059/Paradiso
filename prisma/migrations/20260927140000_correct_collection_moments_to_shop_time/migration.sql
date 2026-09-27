-- Re-stamp existing collection moments in the shop's timezone.
--
-- Orders taken before the timezone fix had their opening time stamped in the
-- *server's* zone. Vercel runs UTC, so a 10:30 collection was stored as 10:30Z,
-- which is 11:30 in London — an hour after the shop opens. Every pre-existing
-- order reads an hour late.
--
-- The correction keeps each order's stored calendar day and rebuilds the moment
-- as the shop's opening time on that day, in Europe/London. Postgres is asked
-- for the offset rather than being told one, so British Summer Time is handled
-- by the same rules as everything else and the two clocks-change days are not
-- special cases.
--
-- Idempotent: re-running recomputes the same instant from the same day.
UPDATE "orders" o
   SET "collectionDate" =
     (((o."collectionDate"::date + s."earliestCollectionTime"::time)
       AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC')
  FROM "calendar_settings" s
 WHERE s."id" = 1;

-- One order cannot be corrected this way, only removed.
--
-- It was created through the date picker while the bug was live, so its stored
-- day is one earlier than the day that was actually chosen — and unlike the
-- hour, that intent is not recoverable from the row. It also carries two
-- rendered emails with the wrong date frozen into their body text, and a
-- message is a snapshot of what was sent, so correcting the order around them
-- would leave a demo that contradicts itself.
--
-- It was a verification order of mine, not a customer's. Narrowly targeted by
-- the address it was created with; the cascade takes its items, status events,
-- payment ledger and messages with it.
DELETE FROM "orders"
 WHERE "customerId" IN (SELECT "id" FROM "customers" WHERE "email" = 'priya.raman@example.com');

DELETE FROM "customers" WHERE "email" = 'priya.raman@example.com';
