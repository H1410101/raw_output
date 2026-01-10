import { VisualSettings } from "./VisualSettingsService";

export type ScalingLevel = "Min" | "Small" | "Normal" | "Large" | "Max";

export const SCALING_FACTORS: Record<ScalingLevel, number> = {
  ["Min"]: 0.5,
  ["Small"]: 0.7,
  ["Normal"]: 1.0,
  ["Large"]: 1.4,
  ["Max"]: 2.0,
};

/**
 * Service for calculating proportional dimensions and sizes based on visual settings.
 */
export class ScalingService {
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
    const factor: number = SCALING_FACTORS[level] ?? SCALING_FACTORS.Normal;

    return baseValue * factor;
  }
}
