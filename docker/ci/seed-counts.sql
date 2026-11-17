SELECT
  (SELECT count(*) FROM "Users") || '|' ||
  (SELECT count(*) FROM "Patients") || '|' ||
  (SELECT count(*) FROM "Notes" WHERE "Status" = 'Confirmed') || '|' ||
  (SELECT count(*) FROM "Notes" WHERE "AiGenerated" AND "Status" = 'Draft' AND "Kind" = 'soap') || '|' ||
  (SELECT count(*) FROM "__EFMigrationsHistory");
