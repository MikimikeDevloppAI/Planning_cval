#!/usr/bin/env node
/**
 * Utilitaire Supabase DB — exécute du SQL ou des queries sur la base distante.
 *
 * Usage:
 *   node scripts/db.mjs <fichier.sql>         — exécute un fichier SQL
 *   node scripts/db.mjs -q "SELECT ..."        — exécute une requête inline
 *   node scripts/db.mjs -q "SELECT ..." --json  — résultat en JSON
 *
 * Exemples:
 *   node scripts/db.mjs sync-doctor-blocks.sql
 *   node scripts/db.mjs -q "SELECT count(*) FROM work_blocks"
 *   node scripts/db.mjs -q "SELECT * FROM staff WHERE id_staff = 1" --json
 *   node scripts/db.mjs -q "SELECT * FROM assignments WHERE assignment_type = 'DOCTOR' LIMIT 5"
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:sDZM2YplbpCH7Rb0@db.wqqexwaqduneeyisfiht.supabase.co:5432/postgres";

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage:");
    console.error('  node scripts/db.mjs <fichier.sql>');
    console.error('  node scripts/db.mjs -q "SELECT ..."');
    console.error('  node scripts/db.mjs -q "SELECT ..." --json');
    process.exit(1);
  }

  let sql;
  let jsonOutput = args.includes("--json");

  const qIdx = args.indexOf("-q");
  if (qIdx !== -1) {
    sql = args[qIdx + 1];
    if (!sql) {
      console.error("Error: -q requires a SQL query argument");
      process.exit(1);
    }
  } else {
    const filePath = resolve(args[0]);
    try {
      sql = readFileSync(filePath, "utf8");
    } catch (err) {
      console.error(`Error reading file: ${filePath}`);
      console.error(err.message);
      process.exit(1);
    }
    console.log(`Executing: ${filePath}`);
  }

  const client = await pool.connect();
  try {
    const result = await client.query(sql);

    // Handle multi-statement results
    const results = Array.isArray(result) ? result : [result];
    const lastResult = results[results.length - 1];

    if (lastResult.rows && lastResult.rows.length > 0) {
      if (jsonOutput) {
        console.log(JSON.stringify(lastResult.rows, null, 2));
      } else {
        // Pretty table output
        const cols = lastResult.fields.map((f) => f.name);
        const widths = cols.map((c) =>
          Math.max(
            c.length,
            ...lastResult.rows.map((r) => String(r[c] ?? "NULL").length)
          )
        );

        // Header
        console.log(cols.map((c, i) => c.padEnd(widths[i])).join(" | "));
        console.log(widths.map((w) => "-".repeat(w)).join("-+-"));

        // Rows
        for (const row of lastResult.rows) {
          console.log(
            cols
              .map((c, i) => String(row[c] ?? "NULL").padEnd(widths[i]))
              .join(" | ")
          );
        }
        console.log(`\n(${lastResult.rows.length} rows)`);
      }
    } else {
      // DDL or no-result statements
      const commands = results
        .map((r) => r.command)
        .filter(Boolean)
        .filter((c) => c !== "BEGIN" && c !== "COMMIT");

      if (commands.length > 0) {
        console.log(`OK: ${commands.join(", ")}`);
      }

      const totalRows = results.reduce(
        (sum, r) => sum + (r.rowCount || 0),
        0
      );
      if (totalRows > 0) {
        console.log(`Rows affected: ${totalRows}`);
      }

      console.log("Done.");
    }
  } catch (err) {
    console.error("SQL Error:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.hint) console.error("Hint:", err.hint);
    if (err.position) {
      const pos = parseInt(err.position);
      const context = sql.slice(Math.max(0, pos - 60), pos + 60);
      console.error(`Near position ${pos}: ...${context}...`);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
