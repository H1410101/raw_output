import { BenchmarkScenario } from "../../data/benchmarks";

/**
 * Manages the dynamic width calculation for scenario name labels.
 * Ensures that the longest name fits while responding to font size changes.
 */
export class ScenarioNameWidthManager {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _context: CanvasRenderingContext2D;
  private _maxNameWidth: number = 0;

  /**
   * Initializes the manager with a hidden canvas for text measurement.
   */
  public constructor() {
    this._canvas = document.createElement("canvas");
    this._context = this._canvas.getContext("2d")!;
  }

  public static readonly scenarioNamePaddingRem: number = 0.2;

  /**
   * Calculates the required width for the scenario name column.
   *
   * @param scenarios - The list of scenarios to measure.
   * @param multiplier - The current font size multiplier from visual settings.
   * @returns The calculated width in rem.
   */
  public calculateRequiredWidth(
    scenarios: BenchmarkScenario[],
    multiplier: number,
  ): number {
    if (scenarios.length === 0 || document.fonts.status !== "loaded") {
      return 0;
    }

    const fontConfig = this._getFontConfig();

    if (!fontConfig.weight || !fontConfig.family) {
      return 0;
    }

    this._prepareContext(fontConfig, multiplier);

    const maxPx: number = this._measureMaxScenarioWidth(scenarios);
    const rootFontSize: number = this._getRootFontSize();

    const spacing: number =
      ScenarioNameWidthManager.scenarioNamePaddingRem *
      this._getMarginSpacingMultiplier();

    const widthRem: number = maxPx / rootFontSize + spacing;
    this._maxNameWidth = widthRem;

    return this._maxNameWidth;
  }

  private _getFontConfig(): { weight: string; family: string } {
    const styles: CSSStyleDeclaration = window.getComputedStyle(
      document.documentElement,
    );

    return {
      weight: styles.getPropertyValue("--scenario-name-weight").trim(),
      family: styles.getPropertyValue("--scenario-name-family").trim(),
    };
  }

  private _prepareContext(
    config: { weight: string; family: string },
    multiplier: number,
  ): void {
    const baseRem: number = 0.8;
    const currentFontSizePx: number =
      baseRem * this._getRootFontSize() * multiplier;

    this._context.font = `${config.weight} ${currentFontSizePx}px ${config.family}`;
  }

  private _measureMaxScenarioWidth(scenarios: BenchmarkScenario[]): number {
    let maxPx: number = 0;

    scenarios.forEach((scenario: BenchmarkScenario): void => {
      const metrics: TextMetrics = this._context.measureText(scenario.name);
      maxPx = Math.max(maxPx, metrics.width);
    });

    return maxPx;
  }

  /**
   * Applies the calculated width to the document root as a CSS variable.
   *
   * @param widthRem - The width to apply in rem units.
   */
  public applyWidth(widthRem: number): void {
    document.documentElement.style.setProperty(
      "--scenario-name-width",
      `${widthRem}rem`,
    );
  }

  private _getRootFontSize(): number {
    const fontSize: string = window.getComputedStyle(
      document.documentElement,
    ).fontSize;

    return parseFloat(fontSize) || 16;
  }



  private _getMarginSpacingMultiplier(): number {
    const multiplier: string = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--margin-spacing-multiplier")
      .trim();

    return parseFloat(multiplier) || 1.0;
  }
}
