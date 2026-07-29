import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
} from "../../services/SessionSettingsService";
import {
  FocusManagementService,
  FocusState,
} from "../../services/FocusManagementService";
import { BenchmarkService } from "../../services/BenchmarkService";
import { AudioService } from "../../services/AudioService";
import { CloudflareService } from "../../services/CloudflareService";
import { IdentityService } from "../../services/IdentityService";
import { KovaaksApiService } from "../../services/KovaaksApiService";
import { SettingsSectionRenderer } from "./SettingsSectionRenderer";
import { BenchmarkScrollController } from "./BenchmarkScrollController";
import { RankEstimator } from "../../services/RankEstimator";
import { CosmeticOverrideService } from "../../services/CosmeticOverrideService";

/**
 * Configuration dependencies for BenchmarkSettingsController.
 */
export interface BenchmarkSettingsDependencies {
  readonly visualSettingsService: VisualSettingsService;
  readonly sessionSettingsService: SessionSettingsService;
  readonly focusService: FocusManagementService;
  readonly benchmarkService: BenchmarkService;
  readonly audioService: AudioService;
  readonly cloudflareService: CloudflareService;
  readonly identityService: IdentityService;
  readonly rankEstimator: RankEstimator;
  readonly cosmeticOverride: CosmeticOverrideService;
  readonly kovaaksApiService: KovaaksApiService;
}

/**
 * Orchestrates the display and interaction of the settings menu.
 *
 * Delegates the heavy lifting of UI construction to specialized renderers
 * while managing the lifecycle of the settings overlay.
 */
export class BenchmarkSettingsController {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _focusService: FocusManagementService;
  private readonly _benchmarkService: BenchmarkService;
  private readonly _audioService: AudioService;
  private readonly _sectionRenderer: SettingsSectionRenderer;
  private _currentVisualSettings: VisualSettings;
  private _scrollController: BenchmarkScrollController | null = null;
  private _overlay: HTMLElement | null = null;

  /**
   * Initializes the controller with the required configuration services.
   *
   * @param dependencies - Object holding required services and state.
   */
  public constructor(dependencies: BenchmarkSettingsDependencies) {
    this._visualSettingsService = dependencies.visualSettingsService;
    this._focusService = dependencies.focusService;
    this._benchmarkService = dependencies.benchmarkService;
    this._audioService = dependencies.audioService;
    this._sectionRenderer = new SettingsSectionRenderer({
      visualSettingsService: dependencies.visualSettingsService,
      sessionSettingsService: dependencies.sessionSettingsService,
      cloudflareService: dependencies.cloudflareService,
      identityService: dependencies.identityService,
      kovaaksApiService: dependencies.kovaaksApiService,
      audioService: dependencies.audioService,
    });

    this._currentVisualSettings = this._visualSettingsService.getSettings();

    this._subscribeToFocusEvents();
  }

  /**
   * Opens the settings overlay and populates it with configured sections.
   */
  public openSettingsMenu(): void {
    this._syncCurrentSettings();
    this._removeExistingOverlay();

    const overlay: HTMLElement = this._createOverlay();
    const container: HTMLElement = this._createMenuContainer();
    const card: HTMLElement = this._createMenuCard();
    const thumb: HTMLElement = this._createScrollThumb();

    container.appendChild(card);
    container.appendChild(thumb);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    this._initializeScrollController(card, thumb, container);
  }

  /**
   * Closes the owned overlay and releases its scrolling resources.
   */
  public destroy(): void {
    this._destroyScrollController();
    this._overlay?.remove();
    this._overlay = null;
  }

  private _syncCurrentSettings(): void {
    this._currentVisualSettings = this._visualSettingsService.getSettings();
  }

  private _removeExistingOverlay(): void {
    this._destroyScrollController();

    const existing: Element | null = this._overlay?.isConnected
      ? this._overlay
      : document.querySelector(".settings-overlay");
    this._overlay = null;

    if (existing) {
      existing.remove();
      this._audioService.playHeavy(0.4);
    }
  }

  private _createOverlay(): HTMLElement {
    const overlay: HTMLDivElement = document.createElement("div");
    overlay.className = "settings-overlay";

    overlay.addEventListener("click", (event: MouseEvent): void => {
      if (event.target === overlay) {
        this._closeOverlay(overlay);
      }
    });

    return overlay;
  }

  private _createMenuContainer(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "settings-menu-container visual-settings-container";

    return container;
  }

  private _createScrollThumb(): HTMLElement {
    const thumb: HTMLDivElement = document.createElement("div");
    thumb.className = "custom-scroll-thumb";

    const gripContainer: HTMLDivElement = document.createElement("div");
    gripContainer.className = "grip-container";

    for (let i = 0; i < 3; i++) {
      const grip: HTMLDivElement = document.createElement("div");
      grip.className = `thumb-grip grip-${i}`;
      gripContainer.appendChild(grip);
    }
    thumb.appendChild(gripContainer);

    return thumb;
  }

  private _initializeScrollController(
    scrollArea: HTMLElement,
    thumb: HTMLElement,
    container: HTMLElement,
  ): void {
    this._destroyScrollController();
    this._scrollController = new BenchmarkScrollController({
      scrollContainer: scrollArea,
      scrollThumb: thumb,
      hoverContainer: container,
      appStateService: null,
      audioService: this._audioService,
    });

    this._scrollController.initialize();
  }

  private _closeOverlay(overlay: HTMLElement): void {
    if (this._overlay !== overlay) {
      return;
    }

    this._destroyScrollController();
    this._overlay = null;
    overlay.remove();
    this._audioService.playHeavy(0.4);
  }

  private _destroyScrollController(): void {
    this._scrollController?.destroy();
    this._scrollController = null;
  }

  private _subscribeToFocusEvents(): void {
    this._focusService.subscribe((state: FocusState): void => {
      const isBenchmarkScenario: boolean =
        this._benchmarkService.getDifficulty(state.scenarioName) !== null;

      if (state.reason === "NEW_SCORE" && isBenchmarkScenario) {
        this._removeExistingOverlay();
      }
    });
  }

  private _createMenuCard(): HTMLElement {
    const card: HTMLDivElement = document.createElement("div");
    card.className = "settings-menu-card";

    card.appendChild(this._createTitle());
    this._appendSections(card);

    return card;
  }

  private _appendSections(card: HTMLElement): void {
    this._sectionRenderer.appendLayoutSection(
      card,
      this._currentVisualSettings,
    );

    this._sectionRenderer.appendAudioSection(card);

    this._sectionRenderer.appendElementsSection(
      card,
      this._currentVisualSettings,
    );

    this._sectionRenderer.appendKovaaksSection(card, () => {
      // Refresh menu to show new account
      this.openSettingsMenu();
    });

    this._sectionRenderer.appendPollingSection(card);

    this._sectionRenderer.appendCloudflareSection(card);
  }

  private _createTitle(): HTMLElement {
    const title: HTMLHeadingElement = document.createElement("h2");
    title.textContent = "Visual Settings";

    return title;
  }
}
