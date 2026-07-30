import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BenchmarkScrollController } from "../benchmark/BenchmarkScrollController";
import { BenchmarkTableComponent } from "../benchmark/BenchmarkTableComponent";
import { BenchmarkSettingsController } from "../benchmark/BenchmarkSettingsController";
import { AboutPopupComponent } from "../ui/AboutPopupComponent";
import { RankedHelpPopupComponent } from "../ui/RankedHelpPopupComponent";
import { MockServiceFactory } from "./MockServiceFactory";
import { BenchmarkViewServices } from "../BenchmarkView";

describe("BenchmarkScrollController ownership", (): void => {
  beforeEach(setupOwnershipTest);
  afterEach(resetOwnershipTest);

  it("destroys table controllers when replaced and when destroyed", verifyTableOwnership);
  it(
    "destroys settings controllers on replacement, closure, and destroy",
    verifySettingsOwnership,
  );
  it("destroys about controllers on replacement and closure", verifyAboutOwnership);
  it("destroys ranked help controllers with the popup", verifyRankedHelpOwnership);
});

function setupOwnershipTest(): void {
  vi.stubGlobal("requestAnimationFrame", vi.fn((): number => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  document.body.innerHTML = "";
}

function resetOwnershipTest(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
}

function verifyTableOwnership(): void {
  const destroySpy = vi.spyOn(BenchmarkScrollController.prototype, "destroy");
  const table: BenchmarkTableComponent = createBenchmarkTable();

  table.render([], {});
  table.render([], {});
  expect(destroySpy).toHaveBeenCalledTimes(1);

  table.destroy();
  table.destroy();
  expect(destroySpy).toHaveBeenCalledTimes(2);
}

function verifySettingsOwnership(): void {
  const destroySpy = vi.spyOn(BenchmarkScrollController.prototype, "destroy");
  const controller: BenchmarkSettingsController = createSettingsController();
  useEmptySettingsCard(controller);

  controller.openSettingsMenu();
  controller.openSettingsMenu();
  expect(destroySpy).toHaveBeenCalledTimes(1);

  const overlay: HTMLElement = getRequiredOverlay();
  overlay.click();
  expect(destroySpy).toHaveBeenCalledTimes(2);
  expect(overlay.isConnected).toBe(false);

  controller.openSettingsMenu();
  controller.destroy();
  controller.destroy();
  expect(destroySpy).toHaveBeenCalledTimes(3);
  expect(document.querySelector(".settings-overlay")).toBeNull();
}

function verifyAboutOwnership(): void {
  const destroySpy = vi.spyOn(BenchmarkScrollController.prototype, "destroy");
  const closeCallback = vi.fn();
  const popup: AboutPopupComponent = new AboutPopupComponent();
  popup.subscribeToClose(closeCallback);

  popup.render();
  const firstOverlay: HTMLElement = getRequiredOverlay();
  popup.render();

  expect(destroySpy).toHaveBeenCalledTimes(1);
  expect(firstOverlay.isConnected).toBe(false);
  expect(document.querySelectorAll(".settings-overlay")).toHaveLength(1);

  getRequiredOverlay().click();
  expect(destroySpy).toHaveBeenCalledTimes(2);
  expect(closeCallback).toHaveBeenCalledOnce();
  expect(document.querySelector(".settings-overlay")).toBeNull();
}

function verifyRankedHelpOwnership(): void {
  const destroySpy = vi.spyOn(BenchmarkScrollController.prototype, "destroy");
  const popup: RankedHelpPopupComponent = new RankedHelpPopupComponent();

  popup.render();
  popup.destroy();
  popup.destroy();

  expect(destroySpy).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".settings-overlay")).toBeNull();
}

function createBenchmarkTable(): BenchmarkTableComponent {
  const services: BenchmarkViewServices =
    MockServiceFactory.createViewDependencies();

  return new BenchmarkTableComponent({
    historyService: services.history,
    rankService: services.rank,
    sessionService: services.session,
    appStateService: MockServiceFactory.createAppStateMock(),
    visualSettings: services.visualSettings.getSettings(),
    audioService: services.audio,
    focusService: services.focus,
    rankEstimator: services.rankEstimator,
    cosmeticOverride: services.cosmeticOverride,
    identityService: services.identity,
  });
}

function createSettingsController(): BenchmarkSettingsController {
  const services: BenchmarkViewServices =
    MockServiceFactory.createViewDependencies();

  return new BenchmarkSettingsController({
    visualSettingsService: services.visualSettings,
    sessionSettingsService: services.sessionSettings,
    focusService: services.focus,
    benchmarkService: services.benchmark,
    audioService: services.audio,
    cloudflareService: services.cloudflare,
    identityService: services.identity,
    rankEstimator: services.rankEstimator,
    cosmeticOverride: services.cosmeticOverride,
    kovaaksApiService: services.kovaaksApi,
  });
}

function useEmptySettingsCard(controller: BenchmarkSettingsController): void {
  Object.defineProperty(controller, "_createMenuCard", {
    configurable: true,
    value: createEmptySettingsCard,
  });
}

function createEmptySettingsCard(): HTMLElement {
  const card: HTMLElement = document.createElement("div");
  card.className = "settings-menu-card";

  return card;
}

function getRequiredOverlay(): HTMLElement {
  const overlay: HTMLElement | null = document.querySelector(".settings-overlay");

  if (!overlay) {
    throw new Error("Expected a settings overlay");
  }

  return overlay;
}
