import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../../services/SessionSettingsService";
import { SettingsSectionRenderer } from "./SettingsSectionRenderer";

/**
 * Responsibility: Orchestrate the display and interaction of the settings menu.
 * Delegates the heavy lifting of UI construction to specialized renderers.
 */
export class BenchmarkSettingsController {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private readonly _sectionRenderer: SettingsSectionRenderer;
  private _currentVisualSettings: VisualSettings;
  private _currentSessionSettings: SessionSettings;

  constructor(
    visualSettingsService: VisualSettingsService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._visualSettingsService = visualSettingsService;
    this._sessionSettingsService = sessionSettingsService;
    this._sectionRenderer = new SettingsSectionRenderer(
      visualSettingsService,
      sessionSettingsService,
    );
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.get_settings();
  }

  /**
   * Opens the settings overlay and populates it with configured sections.
   */
  public open_settings_menu(): void {
    this._syncCurrentSettings();

    this._removeExistingOverlay();

    const overlay = this._createOverlay();
    const card = this._createMenuCard();

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  private _syncCurrentSettings(): void {
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.get_settings();
  }

  private _removeExistingOverlay(): void {
    const existing = document.querySelector(".settings-overlay");
    if (existing) {
      existing.remove();
    }
  }

  private _createOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay";

    overlay.addEventListener("click", (event: MouseEvent) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    return overlay;
  }

  private _createMenuCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "settings-menu-card";

    card.appendChild(this._createTitle());

    this._sectionRenderer.appendVisualizationSection(
      card,
      this._currentVisualSettings,
    );

    this._sectionRenderer.appendLayoutSection(
      card,
      this._currentVisualSettings,
    );

    this._sectionRenderer.appendAudioSection(card);

    this._sectionRenderer.appendSessionSection(
      card,
      this._currentSessionSettings,
    );

    return card;
  }

  private _createTitle(): HTMLElement {
    const title = document.createElement("h2");
    title.textContent = "Visual Settings";
    return title;
  }
}
