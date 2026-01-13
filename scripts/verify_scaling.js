import fs from "fs";
import path from "path";

/**
 * Responsibility: Verify that absolute pixel units are not used for layout or sizing.
 * Exceptions are made for 1px/2px hairline borders or shadows, and large off-screen
 * constants used for masking/hiding elements.
 */

const TARGET_DIRECTORIES = ["src"];

const TARGET_FILES = ["index.html"];

const PX_LITERAL_REGEX = /\b(\d+(?:\.\d+)?)px\b/gi;

const ALLOWED_PIXEL_VALUES = new Set(["0", "1", "2"]);

const MINIMUM_OFFSCREEN_THRESHOLD = 500;

const VIOLATIONS = [];

function _walk_directory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      _walk_directory(full_path);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".css")) &&
      !full_path.includes("__tests__")
    ) {
      _verify_file(full_path);
    }
  }
}

function _verify_file(file_path) {
  const content = fs.readFileSync(file_path, "utf8");

  const lines = content.split("\n");

  lines.forEach((line, index) => {
    let match;

    while ((match = PX_LITERAL_REGEX.exec(line)) !== null) {
      const pixel_value_string = match[1];

      const pixel_value = Math.abs(parseFloat(pixel_value_string));

      if (_is_violation(pixel_value, line)) {
        VIOLATIONS.push({
          file: file_path,
          line: index + 1,
          value: match[0],
          context: line.trim(),
        });
      }
    }
  });
}

function _is_violation(pixel_value, line) {
  if (line.includes("rootMargin")) {
    return false;
  }

  if (pixel_value >= MINIMUM_OFFSCREEN_THRESHOLD) {
    return false;
  }

  if (ALLOWED_PIXEL_VALUES.has(pixel_value.toString())) {
    return false;
  }

  return true;
}

function _report_and_exit() {
  if (VIOLATIONS.length === 0) {
    console.log("Success: No unauthorized pixel units found.");
    process.exit(0);
  }

  VIOLATIONS.forEach((violation) => {
    console.error(
      `Violation at ${violation.file}:${violation.line} -> Unauthorized unit "${violation.value}" found.`,
    );
    console.error(`  Context: ${violation.context}\n`);
  });

  console.error(`Total violations: ${VIOLATIONS.length}`);
  console.error("Use relative units (rem, vw, vh) for scaling. 1rem = 16px.");

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
