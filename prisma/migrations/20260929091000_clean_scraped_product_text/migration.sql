-- New entries are cleaned on the way in (src/lib/security/text.ts). This
-- applies the same invisible-character strip to rows written before that:
-- bidi overrides/isolates, zero-width characters, word joiners and the BOM.
-- The class is a regex, so Postgres' ARE engine reads the \uXXXX escapes.
UPDATE "products"
SET "name"        = btrim(regexp_replace("name",        '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]', '', 'g')),
    "tagline"     = btrim(regexp_replace("tagline",     '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]', '', 'g')),
    "description" = btrim(regexp_replace("description", '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]', '', 'g'))
WHERE "name"        ~ '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]'
   OR "tagline"     ~ '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]'
   OR "description" ~ '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]';
