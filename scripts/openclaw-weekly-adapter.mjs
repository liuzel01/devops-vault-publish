#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  process.stderr.write(`OpenClaw Weekly adapter failed: ${message}\n`);
  process.exit(1);
}

function usage() {
  process.stdout.write('Usage: openclaw-weekly-adapter.mjs OUTPUT_PATH YYYY-Www\n');
}

function isoWeekDates(isoWeek) {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) fail(`invalid ISO week '${isoWeek}'`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) fail(`invalid ISO week '${isoWeek}'`);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const daysFromMonday = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, 0, 4 - daysFromMonday + ((week - 1) * 7)));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

function sourcePaths(repo, isoWeek) {
  return isoWeekDates(isoWeek)
    .map((date) => `daily/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`)
    .filter((relativePath) => existsSync(resolve(repo, relativePath)));
}

function parseEnvelope(stdout) {
  const trimmed = stdout.trim();
  const start = trimmed.lastIndexOf('\n{');
  const json = start === -1 ? trimmed : trimmed.slice(start + 1);
  try {
    return JSON.parse(json);
  } catch {
    fail('OpenClaw did not return a parseable JSON envelope');
  }
}

const [outputPath, isoWeek] = process.argv.slice(2);
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (!outputPath || !isoWeek || process.argv.length !== 4) {
  usage();
  process.exit(1);
}

const vaultDir = process.env.DEVOPS_VAULT_DIR;
const openclawBin = process.env.DEVOPS_VAULT_OPENCLAW_BIN || 'openclaw';
const thinking = process.env.DEVOPS_VAULT_WEEKLY_THINKING || 'low';
const timeout = process.env.DEVOPS_VAULT_WEEKLY_TIMEOUT || '180';
if (!vaultDir || !existsSync(resolve(vaultDir, '.git'))) fail('DEVOPS_VAULT_DIR must point to the devops-vault Git repository');

const paths = sourcePaths(vaultDir, isoWeek);
if (paths.length === 0) fail(`no merged Daily documents found for ${isoWeek}; refusing to create an empty Weekly Draft PR`);

const sourceMaterial = paths.map((relativePath) => {
  const content = readFileSync(resolve(vaultDir, relativePath), 'utf8');
  return `--- SOURCE: ${relativePath} ---\n${content}\n--- END SOURCE ---`;
}).join('\n\n');

if (Buffer.byteLength(sourceMaterial, 'utf8') > 200_000) fail('Weekly source material exceeds 200 KiB; split or summarize the Daily documents before scheduling');

const prompt = `You are the scheduled Weekly adapter for a private DevOps knowledge vault. Produce only the Markdown BODY for ISO week ${isoWeek}; do not include YAML frontmatter, a document title, commentary, or code fences around the whole response. Write in the source language.\n\nUse only the supplied merged Daily documents. Do not infer work from calendar time, repository state, or external systems. Summarize completed work, evidence, risks, blockers, and follow-up actions. Preserve source references as repository-relative paths. Never include passwords, API tokens, private keys, cloud access keys, Authorization values, customer data, or unredacted request payloads. If the supplied documents are insufficient for a claimed result, describe the gap rather than inventing it.\n\n${sourceMaterial}`;

let stdout;
try {
  stdout = execFileSync(openclawBin, [
    'agent', 'exec',
    '--cwd', vaultDir,
    '--code-mode', 'direct',
    '--thinking', thinking,
    '--timeout', timeout,
    '--json',
    prompt,
  ], { cwd: vaultDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2 * 1024 * 1024 });
} catch (error) {
  const stderr = String(error.stderr || '').trim();
  fail(stderr ? `OpenClaw invocation failed: ${stderr}` : 'OpenClaw invocation failed');
}

const envelope = parseEnvelope(String(stdout));
const body = typeof envelope.final === 'string' ? envelope.final.trim() : '';
if (!envelope.ok || !body) fail('OpenClaw returned no Weekly Markdown body');
if (body.startsWith('---')) fail('OpenClaw returned YAML frontmatter; the adapter accepts Markdown body only');

writeFileSync(resolve(outputPath), `${body}\n`, { encoding: 'utf8', mode: 0o600 });
process.stdout.write(`Generated Weekly body for ${isoWeek} from ${paths.length} Daily document(s).\n`);
