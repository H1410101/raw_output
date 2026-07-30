import { describe, expect, it, vi } from "vitest";
import { BenchmarkTableComponent } from "../benchmark/BenchmarkTableComponent";
import { BenchmarkViewServices } from "../BenchmarkView";
import { VisualSettings } from "../../services/VisualSettingsService";
import { MockServiceFactory } from "./MockServiceFactory";

const LAYOUT_SETTING_KEYS = [
  "uiScaling",
  "marginSpacing",
  "verticalSpacing",
  "rankFontSize",
  "launchButtonSize",
  "headerFontSize",
  "labelFontSize",
  "categorySpacing",
] as const;

interface TableFixture {
  readonly table: BenchmarkTableComponent;
  readonly settings: VisualSettings;
}

describe("BenchmarkTableComponent settings updates", (): void => {
  it("rebuilds only when table structure changes", (): void => {
    const { table, settings } = _createTableFixture();

    expect(table.updateVisualSettings({ ...settings, audioVolume: 40 })).toBe(false);
    expect(table.updateVisualSettings({ ...settings, audioVolume: 40, dotOpacity: 60 })).toBe(false);
    expect(table.updateVisualSettings({ ...settings, showSessionBest: false })).toBe(true);
  });

  it.each(LAYOUT_SETTING_KEYS)("refreshes both controllers for %s", (key): void => {
    const { table, settings } = _createTableFixture();
    const scrollRefresh = vi.fn();
    const labelRefresh = vi.fn();
    const controllers = table as unknown as Record<string, unknown>;
    controllers["_scrollController"] = { refreshLayout: scrollRefresh };
    controllers["_labelPositioner"] = { refreshLayout: labelRefresh };
    const nextValue = settings[key] === "Max" ? "Min" : "Max";

    expect(table.updateVisualSettings({ ...settings, [key]: nextValue })).toBe(false);
    expect(scrollRefresh).toHaveBeenCalledOnce();
    expect(labelRefresh).toHaveBeenCalledOnce();
  });
});

function _createTableFixture(): TableFixture {
  const services: BenchmarkViewServices = MockServiceFactory.createViewDependencies();
  const settings: VisualSettings = services.visualSettings.getSettings();
  const table = new BenchmarkTableComponent({
    historyService: services.history,
    rankService: services.rank,
    sessionService: services.session,
    appStateService: MockServiceFactory.createAppStateMock(),
    visualSettings: settings,
    audioService: services.audio,
    focusService: services.focus,
    rankEstimator: services.rankEstimator,
    cosmeticOverride: services.cosmeticOverride,
    identityService: services.identity,
  });

  return { table, settings };
}
