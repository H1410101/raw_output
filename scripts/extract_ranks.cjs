const fs = require("fs");
const path = require("path");

/**
 * Script to extract rank threshold information from Viscose Benchmark CSV files.
 * This isolates the scenario names and their corresponding rank scores into separate CSVs
 * in preparation for Phase 2.
 */

const examplesDir = path.join(__dirname, "../.examples");
const files = [
  {
    input:
      "Viscose Benchmarks Beta (File → Make a copy) - Easier Scenarios.csv",
    output: "ranks_easier.csv",
  },
  {
    input:
      "Viscose Benchmarks Beta (File → Make a copy) - Medium Scenarios.csv",
    output: "ranks_medium.csv",
  },
  {
    input: "Viscose Benchmarks Beta (File → Make a copy) - Hard Scenarios.csv",
    output: "ranks_hard.csv",
  },
];

/**
 * Simple CSV line parser that handles quoted strings and escaped quotes.
 */
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

files.forEach((config) => {
  const filePath = path.join(examplesDir, config.input);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping: ${config.input} (not found)`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // 1. Find the header row containing "Scenario" and "Progress"
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.includes("Scenario") && row.includes("Progress")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.log(`Skipping: ${config.input} (could not find header row)`);
    return;
  }

  const headerRow = parseCsvLine(lines[headerIndex]);
  const scenarioCol = headerRow.indexOf("Scenario");
  const categoryCol = scenarioCol - 2;
  const subcategoryCol = scenarioCol - 1;
  const progressCol = headerRow.indexOf("Progress");

  const rankColumns = [];
  for (let j = progressCol + 1; j < headerRow.length; j++) {
    if (headerRow[j]) {
      rankColumns.push({ name: headerRow[j], index: j });
    }
  }

  const outputRows = [
    [
      "Category",
      "Subcategory",
      "Scenario",
      ...rankColumns.map((rc) => rc.name),
    ].join(","),
  ];

  let currentCategory = "";
  let currentSubcategory = "";

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= scenarioCol) continue;

    if (row[categoryCol]) {
      currentCategory = row[categoryCol];
    }
    if (row[subcategoryCol]) {
      currentSubcategory = row[subcategoryCol];
    }

    const scenarioName = row[scenarioCol];
    if (!scenarioName || scenarioName === "Scenario") continue;

    const scores = rankColumns.map((rc) => {
      let val = row[rc.index] || "";
      return val.replace(/,/g, "").replace(/"/g, "");
    });

    const hasValidScore = scores.some((s) => s !== "" && !isNaN(parseFloat(s)));

    if (hasValidScore) {
      let escapedName = scenarioName;
      if (escapedName.includes(",") && !escapedName.startsWith('"')) {
        escapedName = `"${escapedName}"`;
      }
      outputRows.push(
        [currentCategory, currentSubcategory, escapedName, ...scores].join(","),
      );
    }
  }

  // 4. Save the isolated rank information
  const outputPath = path.join(examplesDir, config.output);
  fs.writeFileSync(outputPath, outputRows.join("\n"));
  console.log(`Generated ${config.output} from ${config.input}`);
});
