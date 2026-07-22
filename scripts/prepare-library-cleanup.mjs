#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const KEEP_TITLES = Object.freeze([
  "Sample Document with all the elements",
  "Checking Spenders with No Sales",
]);

function usage() {
  return [
    "Prepare a local backup and a non-destructive Library cleanup candidate.",
    "",
    "Usage:",
    "  node scripts/prepare-library-cleanup.mjs --input <snapshot.json> [--out-dir <directory>] [--timestamp <ISO-8601>]",
    "",
    "The input may be either the raw shared state or the authenticated API envelope",
    "{ initialized, state }. This command never connects to or writes to production.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!["--input", "--out-dir", "--timestamp"].includes(argument)) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.input) throw new Error("--input is required.");
  return options;
}

function parseTimestamp(value) {
  const timestamp = value ?? new Date().toISOString();
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.valueOf())) throw new Error("--timestamp must be a valid ISO-8601 timestamp.");
  return parsed.toISOString();
}

function getState(parsed) {
  const state = parsed && typeof parsed === "object" && "state" in parsed ? parsed.state : parsed;
  if (!state || typeof state !== "object" || state.version !== 1) throw new Error("Input is not a version 1 shared Library snapshot.");
  if (!Array.isArray(state.documents) || !Array.isArray(state.categories)) throw new Error("Input must contain documents and categories arrays.");
  return state;
}

function assertDocumentIdentity(documents) {
  const ids = new Set();
  const slugs = new Set();
  for (const document of documents) {
    if (!document || typeof document !== "object") throw new Error("Every document must be an object.");
    if (typeof document.id !== "string" || !document.id.trim()) throw new Error("Every document must have a non-empty id.");
    if (typeof document.slug !== "string" || !document.slug.trim()) throw new Error(`Document ${document.id} must have a non-empty slug.`);
    if (typeof document.title !== "string" || !document.title.trim()) throw new Error(`Document ${document.id} must have a non-empty title.`);
    if (ids.has(document.id)) throw new Error(`Duplicate document id: ${document.id}`);
    if (slugs.has(document.slug)) throw new Error(`Duplicate document slug: ${document.slug}`);
    ids.add(document.id);
    slugs.add(document.slug);
  }
}

function prepareCandidate(state, timestamp) {
  assertDocumentIdentity(state.documents);
  const keepByTitle = new Map(KEEP_TITLES.map(title => [title, []]));
  for (const document of state.documents) {
    const matches = keepByTitle.get(document.title);
    if (matches) matches.push(document);
  }
  for (const title of KEEP_TITLES) {
    const matches = keepByTitle.get(title);
    if (matches.length !== 1) throw new Error(`Expected exactly one document titled "${title}", found ${matches.length}. No candidate was written.`);
  }

  const keepIds = new Set([...keepByTitle.values()].flat().map(document => document.id));
  const documents = state.documents.map(document => {
    if (keepIds.has(document.id)) {
      const restored = { ...document };
      delete restored.deletedAt;
      return restored;
    }
    return document.deletedAt ? { ...document } : { ...document, deletedAt: timestamp };
  });
  return {
    candidate: { ...state, documents },
    keepDocuments: documents.filter(document => keepIds.has(document.id)),
    newlyTombstoned: documents.filter(document => !keepIds.has(document.id) && document.deletedAt === timestamp).length,
    previouslyTombstoned: documents.filter(document => !keepIds.has(document.id) && document.deletedAt !== timestamp).length,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function filenameTimestamp(timestamp) {
  return timestamp.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const inputPath = path.resolve(options.input);
  const outputDirectory = path.resolve(options["out-dir"] ?? path.join(process.cwd(), ".data", "library-migrations"));
  const rawInput = await readFile(inputPath);
  let parsed;
  try {
    parsed = JSON.parse(rawInput.toString("utf8"));
  } catch {
    throw new Error("Input is not valid JSON.");
  }
  const state = getState(parsed);
  const timestamp = parseTimestamp(options.timestamp);
  const { candidate, keepDocuments, newlyTombstoned, previouslyTombstoned } = prepareCandidate(state, timestamp);
  const suffix = filenameTimestamp(timestamp);
  const backupPath = path.join(outputDirectory, `library-state-v1-production-backup-${suffix}.json`);
  const candidatePath = path.join(outputDirectory, `library-state-v1-cleanup-candidate-${suffix}.json`);
  const reportPath = path.join(outputDirectory, `library-state-v1-cleanup-report-${suffix}.json`);
  const candidateJson = `${JSON.stringify(candidate, null, 2)}\n`;
  const report = {
    generatedAt: timestamp,
    source: inputPath,
    productionWritePerformed: false,
    inputSha256: sha256(rawInput),
    candidateSha256: sha256(candidateJson),
    totalDocuments: candidate.documents.length,
    activeDocuments: candidate.documents.filter(document => !document.deletedAt).length,
    newlyTombstoned,
    previouslyTombstoned,
    preservedCategories: candidate.categories.length,
    keepDocuments: keepDocuments.map(document => ({ id: document.id, slug: document.slug, title: document.title })),
    files: { backup: backupPath, candidate: candidatePath },
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(backupPath, rawInput, { flag: "wx" });
  await writeFile(candidatePath, candidateJson, { flag: "wx" });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  process.stdout.write([
    "Library cleanup package prepared locally; production was not modified.",
    `Backup: ${backupPath}`,
    `Candidate: ${candidatePath}`,
    `Report: ${reportPath}`,
    `Active documents in candidate: ${report.activeDocuments}`,
    ...report.keepDocuments.map(document => `- ${document.title} (${document.id}, ${document.slug})`),
    `Input SHA-256: ${report.inputSha256}`,
  ].join("\n") + "\n");
}

main().catch(error => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
  process.exitCode = 1;
});
