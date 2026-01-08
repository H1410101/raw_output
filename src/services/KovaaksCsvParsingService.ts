import { KovaaksChallengeRun } from "../types/kovaaks";

/**
 * Service for parsing Kovaak's statistics CSV files to extract performance data.
 */
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
    const rows: string[] = csvContent
      .split("\n")
      .map((row: string): string => row.trim());

    const dataMap: Map<string, string> = this._createDataMap(rows);

    const scenarioName: string | undefined = dataMap.get("scenario");

    const scoreStr: string | undefined = dataMap.get("score");

    if (!scenarioName || !scoreStr) {
      return null;
    }

    const score: number = parseFloat(scoreStr);

    if (isNaN(score)) {
      return null;
    }

    return {
      scenarioName,
      score,
      completionDate: this.extractDateFromFilename(filename),
    };
  }

  private _createDataMap(rows: string[]): Map<string, string> {
    const dataMap: Map<string, string> = new Map<string, string>();

    for (const row of rows) {
      if (!row.includes(":,")) {
        continue;
      }

      const [key, value]: string[] = row.split(":,");

      if (key && value) {
        dataMap.set(key.trim().toLowerCase(), value.trim());
      }
    }

    return dataMap;
  }

  /**
   * Extracts the completion date and time from a Kovaak's statistics filename.
   *
   * @param filename - The name of the CSV file.
   * @returns A Date object representing the run completion time.
   */
  public extractDateFromFilename(filename: string): Date {
    const dateMatch: RegExpMatchArray | null = filename.match(
      /(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/,
    );

    if (!dateMatch) {
      return new Date();
    }

    const [, year, month, day, hour, minute, second]: string[] = dateMatch;

    const date: Date = new Date(
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
