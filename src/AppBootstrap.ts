import { BenchmarkService } from "./services/BenchmarkService";
import { BenchmarkView } from "./components/BenchmarkView";
import { HistoryService } from "./services/HistoryService";
import { RankService } from "./services/RankService";
import { SessionService } from "./services/SessionService";
import { SessionSettingsService } from "./services/SessionSettingsService";
import { AppStateService } from "./services/AppStateService";
import { ApplicationStatusView } from "./components/ui/ApplicationStatusView";
import { NavigationController } from "./components/NavigationController";
import { AccountSelectionView } from "./views/AccountSelectionView";
import { ProfileHeaderComponent } from "./components/ProfileHeaderComponent";
import { FocusManagementService } from "./services/FocusManagementService";
import { AboutPopupComponent } from "./components/ui/AboutPopupComponent";
import { RankedView } from "./components/RankedView";
import { VisualSettingsService } from "./services/VisualSettingsService";
import { AudioService } from "./services/AudioService";
import { CloudflareService } from "./services/CloudflareService";
import { IdentityService } from "./services/IdentityService";
import { SessionSyncService } from "./services/SessionSyncService";
import { RankedSessionService } from "./services/RankedSessionService";
import { RankEstimator } from "./services/RankEstimator";
import { SettingsUiFactory } from "./components/ui/SettingsUiFactory";
import { AnalyticsPopupComponent } from "./components/ui/AnalyticsPopupComponent";
import { CosmeticOverrideService } from "./services/CosmeticOverrideService";
import { DeviceDetectionService, DeviceCategory } from "./services/DeviceDetectionService";
import { MobileLandingView } from "./components/MobileLandingView";
import { MobileWarningPopup } from "./components/ui/MobileWarningPopup";
import { KovaaksApiService } from "./services/KovaaksApiService";
import { KovaaksPollingManager } from "./services/KovaaksPollingManager";


/**
 * Orchestrate service instantiation and dependency wiring.
 */
export class AppBootstrap {
  private _benchmarkService!: BenchmarkService;
  private _historyService!: HistoryService;
  private _rankService!: RankService;
  private _appStateService!: AppStateService;
  private _sessionSettingsService!: SessionSettingsService;
  private _sessionService!: SessionService;
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
  private _cosmeticOverrideService!: CosmeticOverrideService;
  private _deviceDetectionService!: DeviceDetectionService;
  private _kovaaksApiService!: KovaaksApiService;
  private _kovaaksPollingManager!: KovaaksPollingManager;



  private _hasPromptedAnalytics: boolean = false;

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
    this._benchmarkService = new BenchmarkService();
    this._historyService = new HistoryService();
    this._rankService = new RankService();
    this._appStateService = new AppStateService();
    this._sessionSettingsService = new SessionSettingsService();
    this._visualSettingsService = new VisualSettingsService();
    this._deviceDetectionService = new DeviceDetectionService();
  }

  private _initTelemetryServices(): void {
    this._audioService = new AudioService(this._visualSettingsService);
    this._cloudflareService = new CloudflareService();
    this._identityService = new IdentityService();
    this._focusService = new FocusManagementService(this._appStateService);
    this._kovaaksApiService = new KovaaksApiService();
  }

  private _initCoordinationServices(): void {
    this._initRankingCore();
    this._initDataPipelines();
  }

  private _initRankingCore(): void {
    this._sessionService = new SessionService(
      this._rankService,
      this._sessionSettingsService,
    );

    this._rankEstimator = new RankEstimator(this._benchmarkService);

    this._rankedSessionService = new RankedSessionService(
      this._benchmarkService,
      this._sessionService,
      this._rankEstimator,
      this._sessionSettingsService,
    );

    this._cosmeticOverrideService = new CosmeticOverrideService(
      this._appStateService,
      this._benchmarkService,
    );
  }

  private _initDataPipelines(): void {
    new SessionSyncService({
      sessionService: this._sessionService,
      rankedSessionService: this._rankedSessionService,
      identityService: this._identityService,
      cloudflareService: this._cloudflareService,
      rankEstimator: this._rankEstimator,
      benchmarkService: this._benchmarkService,
    });

    this._kovaaksPollingManager = new KovaaksPollingManager({
      kovaaksApi: this._kovaaksApiService,
      identity: this._identityService,
      appState: this._appStateService,
      visualSettings: this._visualSettingsService,
      rankedSession: this._rankedSessionService,
      session: this._sessionService,
      focus: this._focusService,
      history: this._historyService,
      benchmark: this._benchmarkService,
    });

    this._historyService.onScoreRecorded(() => {
      this._kovaaksPollingManager.notifyLocalActivity();
    });
  }

  private _initUIComponents(): void {
    this._statusView = this._createStatusView();
    this._benchmarkView = this._createBenchmarkView();
    this._rankedView = this._createRankedView();
    this._createAccountSelectionView();
    this._navigationController = this._createNavigationController();
    new ProfileHeaderComponent(
      this._getRequiredButton("header-profile-btn"),
      this._identityService,
      this._navigationController
    );
  }

  /**
   * Triggers initial rendering and system initialization.
   */
  public async initialize(): Promise<void> {
    this._checkDeviceCompatibility();
    this._statusView.reportReady();
    this._tryApplyDailyDecay();

    await this._renderInitialViews();
    this._checkInitialState();

    this._navigationController.initialize();
    SettingsUiFactory.setAudioService(this._audioService);

    this._setupGlobalInteractions();
    this._checkAnalyticsPrompt();
  }

  private _checkDeviceCompatibility(): void {
    const category: DeviceCategory = this._deviceDetectionService.getDetectedCategory();

    if (category === DeviceCategory.MOBILE) {
      this._handleMobileAccess();
    }

    if (category === DeviceCategory.SUSPICIOUS) {
      this._showMobileWarning();
    }
  }

  private async _renderInitialViews(): Promise<void> {
    await this._benchmarkView.render();
    await this._rankedView.render();
  }

  private _checkInitialState(): void {
    const hasLinkedAccount = this._identityService.hasLinkedAccount();

    if (!hasLinkedAccount) {
      // Logic for showing account selection will be added here
    }
  }

  private _setupGlobalInteractions(): void {
    this._setupActionListeners();
    this._setupGlobalButtonSounds();
    this._setupKeyboardShortcuts();
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
        visualSettings: this._visualSettingsService,
        audio: this._audioService,
        cloudflare: this._cloudflareService,
        identity: this._identityService,
        rankEstimator: this._rankEstimator,
        cosmeticOverride: this._cosmeticOverrideService,
        kovaaksApi: this._kovaaksApiService,
        onScenarioLaunch: (name) => this._kovaaksPollingManager.notifyBenchmarkLaunched(name),
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
        accountSelectionView: this._getRequiredElement("view-account-selection"),
      },
      {
        benchmarkView: this._benchmarkView,
        appStateService: this._appStateService,
        rankedSession: this._rankedSessionService,
        rankedView: this._rankedView,
        focusService: this._focusService,
        identityService: this._identityService,
      },
    );
  }

  private _createAccountSelectionView(): AccountSelectionView {
    return new AccountSelectionView(
      this._getRequiredElement("view-account-selection"),
      this._identityService,
      this._kovaaksApiService,
      (profile) => {
        this._identityService.setActiveProfile(profile.username);
        // After selecting, return to previous or benchmarks
        const activeTab = this._appStateService.getActiveTabId();
        if (activeTab === "nav-ranked") {
          // Use restore logic
          this._navigationController.initialize();
        } else {
          this._navigationController.initialize();
        }
      }
    );
  }

  private _createRankedView(): RankedView {
    return new RankedView(this._getRequiredElement("view-ranked"), {
      rankedSession: this._rankedSessionService,
      session: this._sessionService,
      benchmark: this._benchmarkService,
      estimator: this._rankEstimator,
      cosmeticOverride: this._cosmeticOverrideService,
      appState: this._appStateService,
      history: this._historyService,
      visualSettings: this._visualSettingsService,
      sessionSettings: this._sessionSettingsService,
      audio: this._audioService,
    });
  }

  private _tryApplyDailyDecay(): void {
    const isRankedActive =
      this._rankedSessionService.state.status === "ACTIVE" ||
      this._rankedSessionService.state.status === "COMPLETED";

    const isBenchmarkActive = this._sessionService.isSessionActive();

    if (!isRankedActive && !isBenchmarkActive) {
      this._rankEstimator.applyDailyDecay();
    }
  }

  private _handleMobileAccess(): void {
    const appElement: HTMLElement = this._getRequiredElement("app");
    appElement.style.display = "none";

    const mainContainer = document.querySelector(".container") as HTMLElement;
    if (mainContainer) {
      mainContainer.style.display = "none";
    }

    const landing = new MobileLandingView(document.body);
    landing.render();
  }

  private _showMobileWarning(): void {
    const warning = new MobileWarningPopup(this._audioService);
    warning.render();
  }

  private _setupActionListeners(): void {
    this._setupHeaderActions();

    this._sessionService.onSessionUpdated((): void => {
      this._tryApplyDailyDecay();
    });

    this._rankedSessionService.onStateChanged((): void => {
      this._tryApplyDailyDecay();
      this._checkAnalyticsPrompt();
    });

    this._appStateService.onDifficultyChanged((): void => {
      this._benchmarkView.updateDifficulty(
        this._appStateService.getBenchmarkDifficulty(),
      );
      this._rankedView.refresh();
    });

    this._appStateService.onTabChanged((): void => {
      this._checkAnalyticsPrompt();
    });

    this._cosmeticOverrideService.onStateChanged((): void => {
      this._benchmarkView.refresh();
      this._rankedView.refresh();
    });
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

    const aboutBtn = this._getRequiredElement("header-about-btn");

    aboutBtn.addEventListener("click", (): void => {
      const aboutPopup: AboutPopupComponent = new AboutPopupComponent(this._audioService);
      aboutPopup.subscribeToClose((): void => {
        this._audioService.playHeavy(0.4);
      });
      aboutPopup.render();
    });
  }

  private _animateButton(button: HTMLButtonElement): void {
    button.classList.add("clicked");

    setTimeout((): void => {
      button.classList.remove("clicked");
    }, 50);
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

  private _setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        this._handleEscapeKey();
      }
    });
  }

  private _handleEscapeKey(): void {
    const activeOverlays: NodeListOf<Element> =
      document.querySelectorAll(".settings-overlay");

    if (activeOverlays.length > 0) {
      const lastOverlay: HTMLElement = activeOverlays[
        activeOverlays.length - 1
      ] as HTMLElement;

      lastOverlay.click();

      return;
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

  private _checkAnalyticsPrompt(): void {
    if (this._hasPromptedAnalytics) {
      return;
    }

    const state = this._rankedSessionService.state;
    const isPlaying = state.status === "ACTIVE" || state.status === "COMPLETED";
    const isAtSummary = state.status === "SUMMARY";
    const isOnRankedTab = this._appStateService.getActiveTabId() === "nav-ranked";

    if (isPlaying || (isAtSummary && isOnRankedTab)) {
      return;
    }

    if (
      this._identityService.canShowAnalyticsPrompt() &&
      this._identityService.hasLinkedAccount()
    ) {
      const popup: AnalyticsPopupComponent = new AnalyticsPopupComponent(
        this._identityService,
        this._audioService,
      );
      popup.render();
      this._identityService.recordAnalyticsPrompt();
      this._hasPromptedAnalytics = true;
    }
  }
}
