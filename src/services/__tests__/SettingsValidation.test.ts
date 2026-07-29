import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateService } from "../AppStateService";
import { IdentityService } from "../IdentityService";
import { SessionSettingsService } from "../SessionSettingsService";
import { VisualSettingsService } from "../VisualSettingsService";

beforeEach((): void => {
  localStorage.clear();
});

describe("SessionSettingsService validation", (): void => {
  it("loads fields independently and rejects unsafe or unchanged updates", (): void => {
    localStorage.setItem("session_settings", JSON.stringify({
      sessionTimeoutMinutes: -1,
      rankedIntervalMinutes: 8,
      obsolete: true,
    }));
    const service = new SessionSettingsService();
    const listener = vi.fn();
    service.subscribe(listener);

    expect(service.getSettings()).toEqual({ sessionTimeoutMinutes: 15, rankedIntervalMinutes: 8 });
    service.updateSetting("rankedIntervalMinutes", Number.POSITIVE_INFINITY);
    service.updateSetting("rankedIntervalMinutes", 8);
    expect(listener).toHaveBeenCalledOnce();

    service.updateSetting("rankedIntervalMinutes", 10);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("AppStateService validation", (): void => {
  it("keeps known valid state and clamps invalid navigation and scrolling", (): void => {
    localStorage.setItem("raw_output_app_state_testuser", JSON.stringify({
      activeTabId: "unknown-tab",
      benchmarkDifficulty: "invalid",
      isSettingsMenuOpen: "yes",
      benchmarkScrollTop: -50,
      focusedScenarioName: 42,
      obsolete: true,
    }));
    const service = new AppStateService(_identityMock());

    expect(service.getActiveTabId()).toBe("nav-benchmarks");
    expect(service.getBenchmarkScrollTop()).toBe(0);
    expect(service.getFocusedScenarioName()).toBeNull();

    service.setActiveTabId("invalid");
    service.setBenchmarkScrollTop(Number.NaN);
    expect(service.getActiveTabId()).toBe("nav-benchmarks");
    expect(service.getBenchmarkScrollTop()).toBe(0);
  });
});

describe("VisualSettingsService validation", (): void => {
  it("accepts known fields, clamps ranges, and discards invalid values", (): void => {
    localStorage.setItem("visual_settings", JSON.stringify({
      theme: "invalid",
      scalingMode: "Floating",
      uiScaling: "Huge",
      scenarioFontSize: "Large",
      dotOpacity: 150,
      audioVolume: Number.NaN,
      showDotCloud: false,
      obsolete: true,
    }));

    const settings = new VisualSettingsService().getSettings();

    expect(settings).toMatchObject({
      theme: "dark",
      scalingMode: "Floating",
      uiScaling: "Normal",
      scenarioFontSize: "Large",
      dotOpacity: 100,
      audioVolume: 80,
      showDotCloud: false,
    });
    expect(settings).not.toHaveProperty("obsolete");
  });
});

function _identityMock(): IdentityService {
  return {
    getKovaaksUsername: vi.fn((): string => "testuser"),
    onProfilesChanged: vi.fn(),
  } as unknown as IdentityService;
}
