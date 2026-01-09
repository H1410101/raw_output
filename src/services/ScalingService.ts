import { VisualSettings } from "./VisualSettingsService";

export type ScalingLevel = "Min" | "Small" | "Normal" | "Large" | "Max";

export const SCALING_FACTORS: Record<ScalingLevel, number> = {
  ["Min"]: 0.5,
  ["Small"]: 0.75,
  ["Normal"]: 1.0,
  ["Large"]: 1.25,
  ["Max"]: 1.5,
};

/**
 * Service for calculating proportional dimensions and sizes based on visual settings.
 *
 * Implements a multiplier-based scaling system where master scaling and sub-settings
 * amplify each other to maintain aesthetic balance.
 */
export class ScalingService {
  /**
   * Calculates the combined scale factor for a specific setting.
   *
   * @param masterLevel - The global master scaling level.
   * @param specificLevel - The level for the specific sub-setting.
   * @returns The final multiplier.
   */
  public static calculateMultiplier(
    masterLevel: ScalingLevel,
    specificLevel: ScalingLevel,
  ): number {
    const masterFactor: number =
      SCALING_FACTORS[masterLevel] ?? SCALING_FACTORS.Normal;
    const specificFactor: number =
      SCALING_FACTORS[specificLevel] ?? SCALING_FACTORS.Normal;

    return masterFactor * specificFactor;
  }

  /**
   * Resolves a base pixel value against the current scaling configuration.
   *
   * @param baseValue - The base size in pixels.
   * @param settings - The current visual settings.
   * @param key - The specific scaling key to apply.
   * @returns The scaled pixel value.
   */
  public static getScaledValue(
    baseValue: number,
    settings: VisualSettings,
    key: keyof VisualSettings,
  ): number {
    const level: ScalingLevel = settings[key] as ScalingLevel;

    // Specific keys are independent of master scaling to prevent over-amplification
    if (key === "visDotSize" || key === "horizontalSpacing") {
      return baseValue * (SCALING_FACTORS[level] ?? SCALING_FACTORS.Normal);
    }

    const multiplier: number = this.calculateMultiplier(
      settings.masterScaling,
      level,
    );

    return baseValue * multiplier;
  }
}
