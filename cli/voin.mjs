#!/usr/bin/env node

import { readLastFetchedIndex, readNotes, writeLastFetchedIndex } from "../mac-client/store.mjs";

function usage(message) {
  if (message) console.error(`voin: ${message}\n`);
  console.error(`Usage:
  voin list
  voin list --from <index|last-fetched-index>
  voin list --all
  voin list --since <timestamp>`);
  process.exit(message ? 1 : 0);
}

const [command, ...args] = process.argv.slice(2);
if (command === "--help" || command === "-h") usage();
if (command !== "list") usage(command ? `unknown command '${command}'` : "a command is required");

let mode = "cursor";
let value;

if (args.length) {
  if (args[0] === "--all" && args.length === 1) mode = "all";
  else if (args[0] === "--from" && args.length === 2) {
    if (args[1] === "last-fetched-index") mode = "cursor";
    else if (/^\d+$/.test(args[1])) {
      mode = "index";
      value = Number(args[1]);
    } else usage("--from expects a non-negative index or 'last-fetched-index'");
  } else if (args[0] === "--since" && args.length === 2) {
    const timestamp = Date.parse(args[1]);
    if (Number.isNaN(timestamp)) usage("--since expects an ISO-8601 timestamp");
    mode = "since";
    value = timestamp;
  } else usage("invalid list options");
}

const notes = await readNotes();
let selected;

if (mode === "cursor") {
  const cursor = await readLastFetchedIndex();
  selected = notes.filter((note) => note.index > cursor);
  await writeLastFetchedIndex(notes.at(-1)?.index ?? cursor);
} else if (mode === "index") {
  selected = notes.filter((note) => note.index > value);
} else if (mode === "since") {
  selected = notes.filter((note) => Date.parse(note.createdAt) >= value);
} else {
  selected = notes;
}

if (!selected.length) {
  console.log("No notes.");
} else {
  for (const note of selected) {
    console.log(`${note.index}\t${note.createdAt}\t${note.text.replaceAll("\n", " ")}`);
  }
}
