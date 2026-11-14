#!/usr/bin/env node
// Migration safety lint. Runs in CI (Lint & Type-check) on every PR and push.
//
// Usage: node scripts/check-migrations.mjs [migrations-dir]
//   migrations-dir defaults to supabase/migrations (relative to the cwd).
//
// Migrations are applied to production automatically on merge to main
// (the `Migrate production DB` job in .github/workflows/ci.yml), so new
// migration files must:
//   * not be destructive (DROP TABLE/COLUMN/FUNCTION/VIEW/TYPE, TRUNCATE,
//     RENAME, column type changes) unless the file says why, with a line
//     comment `-- safety: allow-destructive <reason>`;
//   * not carry their own transaction control (BEGIN/COMMIT/...): the
//     Supabase CLI already runs each migration file in its own transaction,
//     and an explicit COMMIT ends it early, so a later failure in the file
//     can no longer be rolled back;
//   * be named <14-digit version>_<lowercase_name>.sql.
//
// Files at or below BASELINE were written before this lint existed and are
// already applied (some use BEGIN/COMMIT and DROP COLUMN); they are
// grandfathered and not checked. Never edit an applied migration.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASELINE = '20261114120000'
const NAME_RE = /^\d{14}_[a-z0-9_]+\.sql$/
const OVERRIDE_RE = /^[ \t]*--[ \t]*safety:[ \t]*allow-destructive[ \t]+\S/im

const DESTRUCTIVE = [
  /\bDROP\s+(?:MATERIALIZED\s+)?(?:TABLE|FUNCTION|VIEW|TYPE|SCHEMA|SEQUENCE)\b/gi,
  // ALTER TABLE ... DROP [COLUMN] x (COLUMN is optional in Postgres); dropping
  // a constraint, default, NOT NULL, identity or expression is not destructive.
  /\bALTER\s+TABLE\b[^;]*?\bDROP\s+(?!CONSTRAINT\b|DEFAULT\b|NOT\b|IDENTITY\b|EXPRESSION\b)/gi,
  /\bTRUNCATE\b/gi,
  /\bRENAME\b/gi,
  // ALTER [COLUMN] x [SET DATA] TYPE (COLUMN is optional in Postgres)
  /\bALTER\s+(?:COLUMN\s+)?(?:"[^"]*"|\S+)\s+(?:SET\s+DATA\s+)?TYPE\b/gi,
]

const TRANSACTION_RE = /^(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT)\b/i

// Remove comments, the bodies of dollar-quoted strings and the contents of
// string literals, so none of them trigger a rule; strings and quoted
// identifiers are still scanned whole so a `--` inside them is not mistaken
// for a comment.
function strip(sql) {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    const next = sql[i + 1]
    if (c === '-' && next === '-') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
    } else if (c === '/' && next === '*') {
      let depth = 1
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2 }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2 }
        else i++
      }
      out += ' '
    } else if (c === "'" || c === '"') {
      // E'...' strings treat a backslash as an escape (E'it\'s').
      const escapes =
        c === "'" && /[eE]/.test(sql[i - 1] ?? '') && !/[A-Za-z0-9_]/.test(sql[i - 2] ?? '')
      let j = i + 1
      while (j < sql.length) {
        if (escapes && sql[j] === '\\') j += 2
        else if (sql[j] === c && sql[j + 1] === c) j += 2
        else if (sql[j] === c) break
        else j++
      }
      // String literals are emptied ('' — a `;` inside one must not split a
      // statement); quoted identifiers are kept.
      out += c === "'" ? "''" : sql.slice(i, j + 1)
      i = j + 1
    } else if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (m) {
        const tag = m[0]
        const end = sql.indexOf(tag, i + tag.length)
        out += tag + tag
        i = end === -1 ? sql.length : end + tag.length
      } else {
        out += c
        i++
      }
    } else {
      out += c
      i++
    }
  }
  return out
}

const oneLine = (s) => s.replace(/\s+/g, ' ').trim()

const dir = process.argv[2] ?? 'supabase/migrations'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const violations = []
let checked = 0
let grandfathered = 0

for (const file of files) {
  const version = /^\d{14}/.exec(file)?.[0]
  if (version && version <= BASELINE) {
    grandfathered++
    continue
  }
  checked++
  if (!NAME_RE.test(file)) {
    violations.push(`${file}: [name] file name must match <14 digits>_<lowercase_name>.sql — create it with \`supabase migration new <name>\``)
    if (!version) continue
  }

  const original = readFileSync(join(dir, file), 'utf8')
  // SQL-standard function bodies (BEGIN ATOMIC ... END) are blanked so their
  // inner `;` and closing END are not read as transaction control.
  const sql = strip(original).replace(/\bBEGIN\s+ATOMIC\b[\s\S]*?\bEND\b/gi, ' ')

  if (!OVERRIDE_RE.test(original)) {
    for (const re of DESTRUCTIVE) {
      for (const m of sql.matchAll(re)) {
        violations.push(`${file}: [destructive] "${oneLine(m[0])}" — production migrates automatically on merge; use expand/contract (stop using it first, drop/rename in a later PR) and add a line \`-- safety: allow-destructive <reason>\` when it is intended`)
      }
    }
  }

  for (const stmt of sql.split(';')) {
    const s = oneLine(stmt)
    if (TRANSACTION_RE.test(s)) {
      violations.push(`${file}: [transaction] "${s};" — remove it: the Supabase CLI already wraps each migration file in its own transaction, and an explicit COMMIT breaks automatic rollback of the file (no override)`)
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(`✗ ${v}`)
  console.error(`\nMigration safety lint failed: ${violations.length} violation(s) in ${dir}.`)
  process.exit(1)
}

console.log(`Migration safety lint OK: ${checked} checked, ${grandfathered} grandfathered (≤ ${BASELINE}).`)
