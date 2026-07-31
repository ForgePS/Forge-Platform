import postgres from "postgres";

const urls = [
  process.env.DATABASE_URL ??
    "postgresql://forge:forge_local_only@localhost:5432/forge_platform_local",
  "postgresql://forge:forge_local_only@localhost:5432/forge_platform_test",
];

for (const url of urls) {
  const sql = postgres(url, { max: 1 });
  await sql.unsafe(`
    truncate table
      neris_schema_validation_results,
      neris_schema_import_history,
      neris_value_set_hierarchy,
      neris_value_options,
      neris_value_sets,
      neris_field_mappings,
      neris_field_conditions,
      neris_fields,
      neris_module_groups,
      neris_modules,
      neris_schema_versions,
      neris_schema_packages
    cascade
  `);
  console.warn(JSON.stringify({ truncated: url }));
  await sql.end({ timeout: 5 });
}
