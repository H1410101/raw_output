import fs from "fs";
import path from "path";

/**
 * Responsibility: Verify that no hardcoded colors are used in the product codebase.
 * Colors must reference functional tokens. Only src/styles/palette.css is allowed
 * to contain hex/rgb(a) color literals or raw RGB triplets for the sake of centralized definition.
 */

const TARGET_DIRECTORIES = ["src"];

const TARGET_FILES = ["index.html"];

const PALETTE_FILE = path.join("src", "styles", "palette.css");

const COLOR_LITERAL_REGEX =
  /#([a-f0-9]{6}|[a-f0-9]{3})\b|(?<!\.)\b((?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b(?!\.)\s*,\s*(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b(?!\.)\s*,\s*(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b(?!\.))/gi;

const VIOLATIONS = [];

function _walk_directory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(directory, entry.name);

    if (full_path === PALETTE_FILE) continue;

    if (entry.isDirectory()) {
      _walk_directory(full_path);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".css"))
    ) {
      _verify_file(full_path);
    }
  }
}

function _verify_file(file_path) {
  const content = fs.readFileSync(file_path, "utf8");

  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const matches = line.match(COLOR_LITERAL_REGEX);

    if (!matches) return;

    matches.forEach((match) => {
      VIOLATIONS.push({
        file: file_path,
        line: index + 1,
        color: match,
        context: line.trim(),
      });
    });
  });
}

function _report_and_exit() {
  if (VIOLATIONS.length === 0) {
    console.log("Success: No hardcoded colors found outside of palette.css.");
    process.exit(0);
  }

  VIOLATIONS.forEach((violation) => {
    console.error(
      `Violation at ${violation.file}:${violation.line} -> Hardcoded color/triplet "${violation.color}" found.`,
    );
    console.error(`  Context: ${violation.context}\n`);
  });

  console.error(`Total violations: ${VIOLATIONS.length}`);
  console.error(
    "All colors must be defined in src/styles/palette.css and used via var(--token-name).",
  );

  process.exit(1);
}

function run_verification() {
  TARGET_FILES.forEach((file) => {
    if (fs.existsSync(file)) {
      _verify_file(file);
    }
  });

  TARGET_DIRECTORIES.forEach((dir) => {
    if (fs.existsSync(dir)) {
      _walk_directory(dir);
    }
  });

  _report_and_exit();
}

run_verification();
