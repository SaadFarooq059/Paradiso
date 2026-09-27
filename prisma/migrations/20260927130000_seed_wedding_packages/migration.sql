-- The placeholder wedding packages, for databases that never run the seed.
--
-- The previous migration creates wedding_packages empty. Right for the table,
-- wrong as data: a live database has rows, so it never runs the seed, and an
-- empty package list makes a quote come to the sum of its adjustments alone. It
-- did — a live quote that should have been £860 came out at £80, which is the
-- kind of number somebody sends a customer.
--
-- Same standing as the placeholder prices: invented, plausible, labelled as
-- placeholder in the UI. Idempotent, and it never overwrites a package that has
-- since been edited.

INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","active","sortOrder")
VALUES ('classico-tier', 'Classico Tier', 'Two tiers of the Classico recipe, finished simply.', 45000,
        ARRAY['Two tiers, serving up to 60', 'Cocoa-dusted finish', 'Delivery within Greater London', 'Cake stand on loan'], true, 0)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","active","sortOrder")
VALUES ('celebration', 'Celebration', 'Three tiers with a cutting cake and a tasting session.', 78000,
        ARRAY['Three tiers, serving up to 120', 'Matching cutting cake', 'Tasting session for two', 'Delivery and on-site setup', 'Stands and trays on loan'], true, 1)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","active","sortOrder")
VALUES ('grand-affair', 'Grand Affair', 'Five tiers, bespoke finish, staffed setup on the day.', 145000,
        ARRAY['Five tiers, serving up to 250', 'Bespoke decoration to your brief', 'Tasting session for four', 'Delivery, setup and a member of staff on site', 'Full stand and tray hire'], true, 2)
ON CONFLICT ("id") DO NOTHING;
