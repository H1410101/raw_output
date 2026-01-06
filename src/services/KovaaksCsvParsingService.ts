import { KovaaksChallengeRun } from "../types/kovaaks";

export class KovaaksCsvParsingService {
  /**
   * Parse a Kovaak's CSV file and extract training run data.
   * @param csvContent The raw string content of the CSV file.
   * @param filename The name of the file, used for date extraction.
   * @returns A Partial<KovaaksChallengeRun> object or null if parsing fails.
   */
  public parseKovaakCsv(
    csvContent: string,
    filename: string = "",
  ): Partial<KovaaksChallengeRun> | null {
    const rows = csvContent.split("\n").map((r) => r.trim());
    const dataMap = this._createDataMap(rows);

    const scenarioName = dataMap.get("scenario");
    const scoreStr = dataMap.get("score");

    if (!scenarioName || !scoreStr) {
      return null;
    }

    const score = parseFloat(scoreStr);
    if (isNaN(score)) return null;

    return {
      scenarioName,
      score,
      completionDate: this.extractDateFromFilename(filename),
    };
  }

  private _createDataMap(rows: string[]): Map<string, string> {
    const dataMap = new Map<string, string>();

    for (const row of rows) {
      if (!row.includes(":,")) continue;

      const [key, value] = row.split(":,");
      if (key && value) {
        dataMap.set(key.trim().toLowerCase(), value.trim());
      }
    }

    return dataMap;
  }

  public extractDateFromFilename(filename: string): Date {
    // Kovaak's format: "... - Challenge - 2026.01.06-11.07.58 Stats.csv"
    const dateMatch = filename.match(
      /(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/,
    );
    if (!dateMatch) return new Date();

    const [_, year, month, day, hour, minute, second] = dateMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );

    return isNaN(date.getTime()) ? new Date() : date;
  }
}
