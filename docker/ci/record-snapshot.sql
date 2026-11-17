-- Comparison checksum only; not a security or integrity guarantee.
SELECT json_build_object(
  'users', (SELECT count(*) FROM "Users"),
  'patients', (SELECT count(*) FROM "Patients"),
  'notes', (SELECT count(*) FROM "Notes"),
  'migrations', (SELECT count(*) FROM "__EFMigrationsHistory"),
  'noteFingerprint', (
    SELECT md5(string_agg(row_to_json(n)::text, E'\n' ORDER BY n."Id"))
    FROM "Notes" AS n
  )
);
