import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../../services/SessionSettingsService";
import {
  FocusManagementService,
  FocusState,
} from "../../services/FocusManagementService";
import { BenchmarkService } from "../../services/BenchmarkService";
import { SettingsSectionRenderer } from "./SettingsSectionRenderer";

/**
 * Orchestrates the display and interaction of the settings menu.
 *
 * Delegates the heavy lifting of UI construction to specialized renderers
 * while managing the lifecycle of the settings overlay.
 */
export class BenchmarkSettingsController {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private readonly _focusService: FocusManagementService;
  private readonly _benchmarkService: BenchmarkService;
  private readonly _sectionRenderer: SettingsSectionRenderer;
  private _currentVisualSettings: VisualSettings;
  private _currentSessionSettings: SessionSettings;

  /**
   * Initializes the controller with the required configuration services.
   *
   * @param visualSettingsService - Service for visualization and layout state.
   * @param sessionSettingsService - Service for session timing and behavior state.
   * @param focusService - Service for monitoring scenario focus events.
   * @param benchmarkService - Service for verifying scenario difficulty membership.
   */
  public constructor(
    visualSettingsService: VisualSettingsService,
    sessionSettingsService: SessionSettingsService,
    focusService: FocusManagementService,
    benchmarkService: BenchmarkService,
  ) {
    this._visualSettingsService = visualSettingsService;
    this._sessionSettingsService = sessionSettingsService;
    this._focusService = focusService;
    this._benchmarkService = benchmarkService;
    this._sectionRenderer = new SettingsSectionRenderer(
      visualSettingsService,
      sessionSettingsService,
    );

    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.getSettings();

    this._subscribeToFocusEvents();
  }

  /**
   * Opens the settings overlay and populates it with configured sections.
   */
  public openSettingsMenu(): void {
    this._syncCurrentSettings();
    this._removeExistingOverlay();

    const overlay: HTMLElement = this._createOverlay();
    const card: HTMLElement = this._createMenuCard();

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  private _syncCurrentSettings(): void {
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.getSettings();
  }

  private _removeExistingOverlay(): void {
    const existing: Element | null =
      document.querySelector(".settings-overlay");
    if (existing) {
      existing.remove();
    }
  }

  private _createOverlay(): HTMLElement {
    const overlay: HTMLDivElement = document.createElement("div");
    overlay.className = "settings-overlay";

    overlay.addEventListener("click", (event: MouseEvent): void => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    return overlay;
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
  }

  private _createTitle(): HTMLElement {
    const title: HTMLHeadingElement = document.createElement("h2");
    title.textContent = "Visual Settings";

    return title;
  }
}
