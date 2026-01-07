import fs from 'fs';
import path from 'path';

/**
 * Responsibility: Verify that no hardcoded colors are used in the product codebase.
 * Colors must reference the functional tokens defined in index.html :root.
 */

const TARGET_DIRECTORIES = ['src'];

const TARGET_FILES = ['index.html'];

const COLOR_LITERAL_REGEX = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b|rgba?\( *[0-9]+ *, *[0-9]+ *, *[0-9]+ *(?:, *[0-9.]+ *)?\)/g;

const CSS_VARIABLE_DECLARATION_REGEX = /^ *--[a-zA-Z0-9-]+-?r?g?b?: /;

const VIOLATIONS = [];

function _walk_directory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      _walk_directory(full_path);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      _verify_file(full_path);
    }
  }
}

function _verify_file(file_path) {
  const content = fs.readFileSync(file_path, 'utf8');

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const matches = line.match(COLOR_LITERAL_REGEX);

    if (!matches) return;

    const is_index_html = file_path.endsWith('index.html');

    const is_declaration = CSS_VARIABLE_DECLARATION_REGEX.test(line);

    if (is_index_html && is_declaration) return;

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
    process.exit(0);
  }

  VIOLATIONS.forEach((violation) => {
    console.error(
      `Violation at ${violation.file}:${violation.line} -> Hardcoded color "${violation.color}" found.`
    );
    console.error(`  Context: ${violation.context}\n`);
  });

  console.error(`Total violations: ${VIOLATIONS.length}`);

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
