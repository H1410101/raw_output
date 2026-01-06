const fs = require('fs');
const path = require('path');

/**
 * Script to extract rank threshold information from Viscose Benchmark CSV files.
 * This isolates the scenario names and their corresponding rank scores into separate CSVs
 * in preparation for Phase 2.
 */

const examplesDir = path.join(__dirname, '../.examples');
const files = [
  {
    input: 'Viscose Benchmarks Beta (File → Make a copy) - Easier Scenarios.csv',
    output: 'ranks_easier.csv'
  },
  {
    input: 'Viscose Benchmarks Beta (File → Make a copy) - Medium Scenarios.csv',
    output: 'ranks_medium.csv'
  },
  {
    input: 'Viscose Benchmarks Beta (File → Make a copy) - Hard Scenarios.csv',
    output: 'ranks_hard.csv'
  }
];

/**
 * Simple CSV line parser that handles quoted strings and escaped quotes.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

files.forEach(config => {
  const filePath = path.join(examplesDir, config.input);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping: ${config.input} (not found)`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  // 1. Find the header row containing "Scenario" and "Progress"
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.includes('Scenario') && row.includes('Progress')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.log(`Skipping: ${config.input} (could not find header row)`);
    return;
  }

  const headerRow = parseCsvLine(lines[headerIndex]);
  const scenarioCol = headerRow.indexOf('Scenario');
  const progressCol = headerRow.indexOf('Progress');

  // 2. Identify rank columns (non-empty columns following the Progress column)
  const rankColumns = [];
  for (let j = progressCol + 1; j < headerRow.length; j++) {
    if (headerRow[j]) {
      rankColumns.push({ name: headerRow[j], index: j });
    }
  }

  const outputRows = [['Scenario', ...rankColumns.map(rc => rc.name)].join(',')];

  // 3. Extract data for each scenario
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= scenarioCol) continue;

    const scenarioName = row[scenarioCol];

    // Skip rows without a scenario name or the header row itself
    if (!scenarioName || scenarioName === 'Scenario') continue;

    const scores = rankColumns.map(rc => {
      let val = row[rc.index] || '';
      // Clean up numbers: remove commas and any stray quotes
      return val.replace(/,/g, '').replace(/"/g, '');
    });

    // Validate that this is a data row (should have at least one numeric score)
    const hasValidScore = scores.some(s => s !== '' && !isNaN(parseFloat(s)));

    if (hasValidScore) {
      // Wrap scenario name in quotes if it contains a comma or is already partially quoted
      let escapedName = scenarioName;
      if (escapedName.includes(',') && !escapedName.startsWith('"')) {
        escapedName = `"${escapedName}"`;
      }
      outputRows.push([escapedName, ...scores].join(','));
    }
  }

  // 4. Save the isolated rank information
  const outputPath = path.join(examplesDir, config.output);
  fs.writeFileSync(outputPath, outputRows.join('\n'));
  console.log(`Generated ${config.output} from ${config.input}`);
});
