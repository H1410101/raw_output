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
    if (scenarios.length === 0) {
      return 15;
    }

    const masterScale: number = this._getMasterScale();
    const rootFontSize: number = this._getRootFontSize();
    const unscaledRootFontSize: number = rootFontSize / masterScale;

    const styles: CSSStyleDeclaration = window.getComputedStyle(
      document.documentElement,
    );
    const weight: string = styles
      .getPropertyValue("--scenario-name-weight")
      .trim();
    const family: string = styles
      .getPropertyValue("--scenario-name-family")
      .trim();

    if (!weight || !family || document.fonts.status !== "loaded") {
      return 15;
    }

    const baseRem: number = 0.9;
    const currentFontSizePx: number =
      baseRem * unscaledRootFontSize * multiplier * masterScale;

    this._context.font = `${weight} ${currentFontSizePx}px ${family}`;

    let maxPx: number = 0;
    scenarios.forEach((scenario: BenchmarkScenario): void => {
      const metrics: TextMetrics = this._context.measureText(scenario.name);
      maxPx = Math.max(maxPx, metrics.width);
    });

    const paddingRem: number = 2.6;
    const widthRem: number = maxPx / unscaledRootFontSize + paddingRem;

    this._maxNameWidth = Math.max(15, widthRem);

    return this._maxNameWidth;
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

  private _getMasterScale(): number {
    const scale: string = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--master-scale")
      .trim();

    return parseFloat(scale) || 1.0;
  }
}
