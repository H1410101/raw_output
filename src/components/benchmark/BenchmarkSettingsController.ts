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
 * Orchestrates the display and interaction of the settings menu.
 *
 * Delegates the heavy lifting of UI construction to specialized renderers
 * while managing the lifecycle of the settings overlay.
 */
export class BenchmarkSettingsController {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private readonly _sectionRenderer: SettingsSectionRenderer;
  private _currentVisualSettings: VisualSettings;
  private _currentSessionSettings: SessionSettings;

  /**
   * Initializes the controller with the required configuration services.
   *
   * @param visualSettingsService - Service for visualization and layout state.
   * @param sessionSettingsService - Service for session timing and behavior state.
   */
  public constructor(
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
    this._currentSessionSettings = this._sessionSettingsService.getSettings();
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

    requestAnimationFrame((): void => {
      this._normalizeLabelWidths(card);
    });
  }

  private _syncCurrentSettings(): void {
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.getSettings();
  }

  private _removeExistingOverlay(): void {
    const existing: Element | null = document.querySelector(".settings-overlay");
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

  private _createMenuCard(): HTMLElement {
    const card: HTMLDivElement = document.createElement("div");
    card.className = "settings-menu-card";

    card.appendChild(this._createTitle());
    this._appendSections(card);

    return card;
  }

  private _appendSections(card: HTMLElement): void {
    this._sectionRenderer.appendVisualizationSection(card, this._currentVisualSettings);
    this._sectionRenderer.appendLayoutSection(card, this._currentVisualSettings);
    this._sectionRenderer.appendAudioSection(card);
    this._sectionRenderer.appendSessionSection(card, this._currentSessionSettings);
  }

  private _createTitle(): HTMLElement {
    const title: HTMLHeadingElement = document.createElement("h2");
    title.textContent = "Visual Settings";

    return title;
  }

  private _normalizeLabelWidths(card: HTMLElement): void {
    const labels: NodeListOf<HTMLElement> = card.querySelectorAll(".setting-item label");
    let maxLabelWidth: number = 0;

    labels.forEach((label: HTMLElement): void => {
      label.style.width = "auto";
      maxLabelWidth = Math.max(maxLabelWidth, label.offsetWidth);
    });

    labels.forEach((label: HTMLElement): void => {
      label.style.width = `${maxLabelWidth}px`;
      label.style.flex = "0 0 auto";
    });
  }
}
