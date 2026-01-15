import { DirectoryAccessService } from "./services/DirectoryAccessService";

import { KovaaksCsvParsingService } from "./services/KovaaksCsvParsingService";
import { DirectoryMonitoringService } from "./services/DirectoryMonitoringService";
import { BenchmarkService } from "./services/BenchmarkService";
import { BenchmarkView } from "./components/BenchmarkView";
import { HistoryService } from "./services/HistoryService";
import { RankService } from "./services/RankService";
import { SessionService } from "./services/SessionService";
import { SessionSettingsService } from "./services/SessionSettingsService";
import { RunIngestionService } from "./services/RunIngestionService";
import { AppStateService } from "./services/AppStateService";
import { ApplicationStatusView } from "./components/ui/ApplicationStatusView";
import { NavigationController } from "./components/NavigationController";
import { FocusManagementService } from "./services/FocusManagementService";
import { AboutPopupComponent } from "./components/ui/AboutPopupComponent";
import { RankedView } from "./components/RankedView";
import { VisualSettingsService } from "./services/VisualSettingsService";
import { AudioService } from "./services/AudioService";
import { CloudflareService } from "./services/CloudflareService";
import { IdentityService } from "./services/IdentityService";
import { SessionPulseService } from "./services/SessionPulseService";
import { RankedSessionService } from "./services/RankedSessionService";
import { RankEstimator } from "./services/RankEstimator";
import { SettingsUiFactory } from "./components/ui/SettingsUiFactory";

/**
 * Orchestrate service instantiation and dependency wiring.
 */
export class AppBootstrap {
  private _directoryService!: DirectoryAccessService;

  private _csvService!: KovaaksCsvParsingService;

  private _monitoringService!: DirectoryMonitoringService;

  private _benchmarkService!: BenchmarkService;

  private _historyService!: HistoryService;

  private _rankService!: RankService;

  private _appStateService!: AppStateService;

  private _sessionSettingsService!: SessionSettingsService;

  private _sessionService!: SessionService;

  private _ingestionService!: RunIngestionService;

  private _focusService!: FocusManagementService;

  private _statusView!: ApplicationStatusView;

  private _benchmarkView!: BenchmarkView;
  private _rankedView!: RankedView;

  private _navigationController!: NavigationController;

  private _visualSettingsService!: VisualSettingsService;

  private _audioService!: AudioService;
  private _cloudflareService!: CloudflareService;
  private _identityService!: IdentityService;
  private _rankedSessionService!: RankedSessionService;
  private _rankEstimator!: RankEstimator;

  /**
   * Initializes the application's core logic and UI components.
   */
  public constructor() {
    this._initCoreServices();
    this._initTelemetryServices();
    this._initCoordinationServices();
    this._initUIComponents();
  }

  private _initCoreServices(): void {
    this._directoryService = new DirectoryAccessService();
    this._csvService = new KovaaksCsvParsingService();
    this._monitoringService = new DirectoryMonitoringService();
    this._benchmarkService = new BenchmarkService();
    this._historyService = new HistoryService();
    this._rankService = new RankService();
    this._appStateService = new AppStateService();
    this._sessionSettingsService = new SessionSettingsService();
    this._visualSettingsService = new VisualSettingsService();
  }

  private _initTelemetryServices(): void {
    this._audioService = new AudioService(this._visualSettingsService);
    this._cloudflareService = new CloudflareService();
    this._identityService = new IdentityService();
    this._focusService = new FocusManagementService(this._appStateService);
  }

  private _initCoordinationServices(): void {
    this._sessionService = new SessionService(
      this._rankService,
      this._sessionSettingsService,
    );

    this._rankEstimator = new RankEstimator(
      this._benchmarkService,
    );

    this._rankedSessionService = new RankedSessionService(
      this._benchmarkService,
      this._sessionService,
      this._rankEstimator,
    );

    new SessionPulseService(
      this._sessionService,
      this._rankedSessionService,
      this._identityService,
      this._cloudflareService,
    );

    this._ingestionService = new RunIngestionService({
      directoryService: this._directoryService,
      csvService: this._csvService,
      historyService: this._historyService,
      sessionService: this._sessionService,
      benchmarkService: this._benchmarkService,
    });
  }

  private _initUIComponents(): void {
    this._statusView = this._createStatusView();
    this._benchmarkView = this._createBenchmarkView();
    this._rankedView = this._createRankedView();
    this._navigationController = this._createNavigationController();
  }

  /**
   * Triggers initial rendering and system initialization.
   */
  public async initialize(): Promise<void> {
    this._statusView.reportReady();
    this._rankEstimator.applyDailyDecay();

    await this._attemptInitialReconnection();

    await this._benchmarkView.render();
    await this._rankedView.render();

    this._navigationController.initialize();

    SettingsUiFactory.setAudioService(this._audioService);

    this._setupActionListeners();
    this._setupGlobalButtonSounds();
  }

  private _createStatusView(): ApplicationStatusView {
    return new ApplicationStatusView(
      this._getRequiredElement("status-mount-point"),
      this._getRequiredElement("status-text-overlay"),
    );
  }

  private _createBenchmarkView(): BenchmarkView {
    return new BenchmarkView(
      this._getRequiredElement("view-benchmarks"),
      {
        benchmark: this._benchmarkService,
        history: this._historyService,
        rank: this._rankService,
        session: this._sessionService,
        sessionSettings: this._sessionSettingsService,
        focus: this._focusService,
        directory: this._directoryService,
        visualSettings: this._visualSettingsService,
        audio: this._audioService,
        cloudflare: this._cloudflareService,
        identity: this._identityService,
        rankEstimator: this._rankEstimator,
        folderActions: {
          onLinkFolder: (): Promise<void> =>
            this._handleManualFolderSelection(),
          onForceScan: (): Promise<void> => this._handleManualImport(),
          onUnlinkFolder: (): void => this._handleFolderRemoval(),
        },
      },
      this._appStateService,
    );
  }

  private _createNavigationController(): NavigationController {
    return new NavigationController(
      {
        benchmarksButton: this._getRequiredButton("nav-benchmarks"),
        rankedButton: this._getRequiredButton("nav-ranked"),
      },
      {
        benchmarksView: this._getRequiredElement("view-benchmarks"),
        rankedView: this._getRequiredElement("view-ranked"),
      },
      {
        benchmarkView: this._benchmarkView,
        appStateService: this._appStateService,
        rankedSession: this._rankedSessionService,
        rankedView: this._rankedView,
      },
    );
  }

  private _createRankedView(): RankedView {
    return new RankedView(this._getRequiredElement("view-ranked"), {
      rankedSession: this._rankedSessionService,
      session: this._sessionService,
      benchmark: this._benchmarkService,
      estimator: this._rankEstimator,
      appState: this._appStateService,
      history: this._historyService,
      visualSettings: this._visualSettingsService,
      audio: this._audioService,
      directory: this._directoryService,
      folderActions: {
        onLinkFolder: (): Promise<void> => this._handleManualFolderSelection(),
        onForceScan: (): Promise<void> => this._handleManualImport(),
        onUnlinkFolder: (): void => this._handleFolderRemoval(),
      },
    });
  }

  private _setupActionListeners(): void {
    this._setupHeaderActions();
  }

  private _setupHeaderActions(): void {
    const settingsBtn = this._getRequiredButton("header-settings-btn");

    settingsBtn.addEventListener("click", (): void => {
      this._animateButton(settingsBtn);

      this._benchmarkView.openSettings();
    });

    const themeBtn = this._getRequiredButton("header-theme-btn");

    themeBtn.addEventListener("click", (): void => {
      this._animateButton(themeBtn);

      this._benchmarkView.toggleTheme();
    });

    const folderBtn = this._getRequiredButton("header-folder-btn");

    folderBtn.addEventListener("click", (): void => {
      this._animateButton(folderBtn);

      if (this._appStateService.getActiveTabId() === "nav-ranked") {
        this._rankedView.toggleFolderView();
      } else {
        this._benchmarkView.toggleFolderView();
      }
    });

    const aboutBtn = this._getRequiredElement("header-about-btn");

    aboutBtn.addEventListener("click", (): void => {
      const aboutPopup: AboutPopupComponent = new AboutPopupComponent(this._audioService);
      aboutPopup.subscribeToClose((): void => {
        this._audioService.playHeavy(0.4);
      });
      aboutPopup.render();
    });

    this._appStateService.onDifficultyChanged((): void => {
      this._benchmarkView.updateDifficulty(this._appStateService.getBenchmarkDifficulty());
      this._rankedView.refresh();
    });
  }

  private _animateButton(button: HTMLButtonElement): void {
    button.classList.add("clicked");

    setTimeout((): void => {
      button.classList.remove("clicked");
    }, 50);
  }

  private async _attemptInitialReconnection(): Promise<void> {
    const handle: FileSystemDirectoryHandle | null =
      await this._directoryService.attemptReconnection();

    if (handle) {
      this._statusView.reportFolderReconnected();

      await this._synchronizeAndMonitor(handle);

      this._benchmarkView.refresh();

      return;
    }

    this._statusView.reportDisconnected();
  }

  private async _handleManualFolderSelection(): Promise<void> {
    const handle: FileSystemDirectoryHandle | null =
      await this._directoryService.requestDirectorySelection();

    if (handle) {
      this._statusView.reportFolderLinked();

      await this._synchronizeAndMonitor(handle);

      this._benchmarkView.refresh();
    }
  }

  private async _handleManualImport(): Promise<void> {
    this._statusView.reportScanning();

    await this._ingestionService.synchronizeAvailableRuns();

    this._statusView.reportActive();

    this._benchmarkView.refresh();
  }

  private _handleFolderRemoval(): void {
    this._directoryService.clearStoredHandle();

    this._monitoringService.stopMonitoring();

    this._statusView.reportDisconnected();

    this._benchmarkView.refresh();
  }

  private async _synchronizeAndMonitor(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    await this._ingestionService.synchronizeAvailableRuns();

    this._startMonitoring(handle);
  }

  private _startMonitoring(handle: FileSystemDirectoryHandle): void {
    this._monitoringService.startMonitoring(handle, async (): Promise<void> => {
      this._statusView.reportScanning();

      const updatedRuns =
        await this._ingestionService.synchronizeAvailableRuns();

      if (updatedRuns.length > 0) {
        this._focusService.focusScenario(
          updatedRuns[0].scenarioName,
          "NEW_SCORE",
        );
      }

      this._statusView.reportActive();
    });
  }

  private _setupGlobalButtonSounds(): void {
    document.addEventListener("click", (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      const button = target.closest("button");
      const link = target.closest("a");
      const title = target.closest(".app-title-container");

      if (button || link || title) {
        this._audioService.playHeavy(0.4);
      }
    });

    const titleElement = document.getElementById("header-about-btn");
    if (titleElement) {
      titleElement.addEventListener("mouseenter", (): void => {
        this._audioService.playLight(0.5);
      });
    }
  }

  private _getRequiredElement(elementId: string): HTMLElement {
    const element: HTMLElement | null = document.getElementById(elementId);

    if (!element) {
      throw new Error(
        `Required application mount point not found: ${elementId}`,
      );
    }

    return element;
  }

  private _getRequiredButton(buttonId: string): HTMLButtonElement {
    const element: HTMLElement = this._getRequiredElement(buttonId);

    if (!(element instanceof HTMLButtonElement)) {
      throw new Error(`Element is not a button: ${buttonId}`);
    }

    return element;
  }
}
