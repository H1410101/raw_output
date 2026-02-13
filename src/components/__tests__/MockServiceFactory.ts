import { vi } from "vitest";

import { BenchmarkScenario } from "../../data/benchmarks";
import { BenchmarkViewServices } from "../BenchmarkView";
import { AppStateService } from "../../services/AppStateService";
import { RankEstimator } from "../../services/RankEstimator";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { HistoryService } from "../../services/HistoryService";
import { VisualSettingsService, VisualSettings } from "../../services/VisualSettingsService";
import { SessionSettingsService } from "../../services/SessionSettingsService";
import { RankedSessionService } from "../../services/RankedSessionService";
import { KovaaksApiService } from "../../services/KovaaksApiService";
import { BenchmarkService } from "../../services/BenchmarkService";
import { FocusManagementService } from "../../services/FocusManagementService";
import { AudioService } from "../../services/AudioService";
import { CloudflareService } from "../../services/CloudflareService";
import { IdentityService } from "../../services/IdentityService";
import { CosmeticOverrideService } from "../../services/CosmeticOverrideService";


/**
 * Factory for creating modular and composable mocks for UI and service tests.
 */
export class MockServiceFactory {
    /**
     * Creates a standard set of mock dependencies for BenchmarkView or RankedView.
     * 
     * @param overrides - Partial dependencies to override the defaults.
     * @returns A complete set of dependencies for view components.
     */
    public static createViewDependencies(overrides: Record<string, unknown> = {}): BenchmarkViewServices {
        const estimator: RankEstimator = this.createRankEstimatorMock(
            (overrides.rankEstimator || overrides.estimator) as Record<string, unknown>
        );

        return {
            ...this._createCoreServices(overrides),
            ...this._createStateServices(overrides),
            ...this._createInfrastructureServices(overrides),
            rankEstimator: estimator,
            estimator: estimator,
            cosmeticOverride: this._createCosmeticOverride(overrides.cosmeticOverride as Record<string, unknown>)
        } as unknown as BenchmarkViewServices;
    }


    /**
     * Creates a mock of the RankEstimator service.
     * 
     * @param overrides - Partial overrides for the estimator.
     * @returns A mock object for the RankEstimator service.
     */
    public static createRankEstimatorMock(overrides: Record<string, unknown> = {}): RankEstimator {
        return {
            getRankEstimateMap: vi.fn().mockReturnValue({}),
            getScenarioEstimate: vi.fn().mockReturnValue({ continuousValue: 1.5, highestAchieved: 1.5, lastUpdated: "" }),
            calculateHolisticEstimateRank: vi.fn().mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 }),
            calculateOverallRank: vi.fn().mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 }),
            getEstimateForValue: vi.fn().mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 }),
            getScenarioContinuousValue: vi.fn().mockReturnValue(1.5),
            applyDailyDecay: vi.fn(),
            applyPenaltyLift: vi.fn(),
            recordPlay: vi.fn(),
            onEstimateUpdated: vi.fn(),
            evolveScenarioEstimate: vi.fn(),
            ...overrides
        } as unknown as RankEstimator;
    }


    /**
     * Creates a mock of the AppState service.
     *
     * @param overrides - Partial overrides for the app state.
     * @returns A mock object for the AppState service.
     */
    public static createAppStateMock(overrides: Record<string, unknown> = {}): AppStateService {
        return {
            getActiveTabId: vi.fn().mockReturnValue("nav-benchmarks"),
            setActiveTabId: vi.fn(),
            onTabChanged: vi.fn(),
            getBenchmarkDifficulty: vi.fn().mockReturnValue("Advanced"),
            setBenchmarkDifficulty: vi.fn(),
            onDifficultyChanged: vi.fn(),
            getIsSettingsMenuOpen: vi.fn().mockReturnValue(false),
            setIsSettingsMenuOpen: vi.fn(),
            getIsFolderViewOpen: vi.fn().mockReturnValue(false),
            setIsFolderViewOpen: vi.fn(),
            getBenchmarkScrollTop: vi.fn().mockReturnValue(0),
            setBenchmarkScrollTop: vi.fn(),
            getFocusedScenarioName: vi.fn().mockReturnValue(null),
            setFocusedScenarioName: vi.fn(),
            ...overrides
        } as unknown as AppStateService;
    }


    private static _createCoreServices(overrides: Record<string, unknown>): Partial<BenchmarkViewServices> {
        return {
            benchmark: this._createBenchmarkService(overrides.benchmark as Record<string, unknown>),
            history: this._createHistoryService(overrides.history as Record<string, unknown>),
            rank: this._createRankService(overrides.rank as Record<string, unknown>),
            session: this._createSessionService(overrides.session as Record<string, unknown>)
        };
    }


    private static _createStateServices(overrides: Record<string, unknown>): Partial<BenchmarkViewServices> {
        return {
            visualSettings: this._createVisualSettingsService(overrides.visualSettings as Record<string, unknown>),
            appState: this.createAppStateMock(overrides.appState as Record<string, unknown>),
            focus: this._createFocusService(overrides.focus as Record<string, unknown>),
            sessionSettings: this._createSessionSettingsService(overrides.sessionSettings as Record<string, unknown>),
            rankedSession: this._createRankedSession(overrides.rankedSession as Record<string, unknown>)
        } as unknown as Partial<BenchmarkViewServices>;
    }


    private static _createInfrastructureServices(overrides: Record<string, unknown>): Partial<BenchmarkViewServices> {
        return {
            audio: { playLight: vi.fn(), playHeavy: vi.fn(), ...(overrides.audio as Record<string, unknown>) } as unknown as AudioService,
            kovaaksApi: this._createKovaaksApiService(overrides.kovaaksApi as Record<string, unknown>),
            cloudflare: { ...(overrides.cloudflare as Record<string, unknown>) } as unknown as CloudflareService,
            identity: this._createIdentityService(overrides.identity as Record<string, unknown>)
        };
    }


    private static _createBenchmarkService(overrides: Record<string, unknown> = {}): BenchmarkService {
        return {
            getScenarios: vi.fn((): BenchmarkScenario[] => [
                { name: "Scenario A", category: "Cat", subcategory: "Sub", thresholds: { ["Bronze"]: 100 } }
            ]),
            getAvailableDifficulties: vi.fn().mockReturnValue(["Advanced"]),
            getRankNames: vi.fn().mockReturnValue(["Bronze", "Silver", "Gold"]),
            getDifficulty: vi.fn().mockReturnValue("Advanced"),
            isPeak: vi.fn().mockReturnValue(false),
            ...overrides
        } as unknown as BenchmarkService;
    }


    private static _createHistoryService(overrides: Record<string, unknown> = {}): HistoryService {
        return {
            getHighscores: vi.fn().mockResolvedValue({ ["Scenario A"]: 120 }),
            getBatchHighscores: vi.fn().mockResolvedValue({ ["Scenario A"]: 120 }),
            getHighscore: vi.fn().mockResolvedValue(120),
            getLastScores: vi.fn().mockResolvedValue([]),
            getLastCheckTimestamp: vi.fn().mockResolvedValue(1000),
            onHighscoreUpdated: vi.fn(),
            onScoreRecorded: vi.fn(),
            ...overrides
        } as unknown as HistoryService;
    }


    private static _createSessionService(overrides: Record<string, unknown> = {}): SessionService {
        return {
            onSessionUpdated: vi.fn(),
            isSessionActive: vi.fn().mockReturnValue(false),
            getScenarioSessionBest: vi.fn().mockReturnValue({ bestScore: 110 }),
            getAllScenarioSessionBests: vi.fn().mockReturnValue([{ scenarioName: "Scenario A", bestScore: 110 }]),
            getRankedScenarioBest: vi.fn().mockReturnValue({ bestScore: 110 }),
            getAllRankedScenarioBests: vi.fn().mockReturnValue([{ scenarioName: "Scenario A", bestScore: 110 }]),
            getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
            sessionStartTimestamp: Date.now(),
            setIsRanked: vi.fn(),
            ...overrides
        } as unknown as SessionService;
    }


    private static _createVisualSettingsService(overrides: Record<string, unknown> = {}): VisualSettingsService {
        return {
            getSettings: vi.fn().mockReturnValue(this._createDefaultVisualSettings()),
            subscribe: vi.fn(),
            updateSetting: vi.fn(),
            ...overrides
        } as unknown as VisualSettingsService;
    }


    private static _createDefaultVisualSettings(): VisualSettings {
        return {
            theme: "dark",
            showDotCloud: true,
            dotOpacity: 40,
            scalingMode: "Aligned",
            dotSize: "Normal",
            visDotSize: "Normal",
            uiScaling: "Normal",
            marginSpacing: "Normal",
            verticalSpacing: "Normal",
            scenarioFontSize: "Normal",
            rankFontSize: "Normal",
            launchButtonSize: "Normal",
            headerFontSize: "Normal",
            labelFontSize: "Normal",
            categorySpacing: "Normal",
            dotCloudSize: "Normal",
            dotCloudWidth: "Normal",
            visRankFontSize: "Normal",
            showSessionBest: true, showAllTimeBest: true,
            dotJitterIntensity: "Normal",
            showRankNotches: true, highlightLatestRun: true,
            showRankEstimate: true, showRanks: true,
            audioVolume: 80,
            showIntervalsSettings: true,
            playAnimationsUnfocused: false
        };
    }


    private static _createFocusService(overrides: Record<string, unknown> = {}): FocusManagementService {
        return {
            subscribe: vi.fn(),
            getFocusState: vi.fn().mockReturnValue(null),
            clearFocus: vi.fn(),
            focusScenario: vi.fn(),
            ...overrides
        } as unknown as FocusManagementService;
    }


    private static _createKovaaksApiService(overrides: Record<string, unknown> = {}): KovaaksApiService {
        return {
            searchUsers: vi.fn().mockResolvedValue([]),
            fetchScenarioLastScores: vi.fn().mockResolvedValue([]),
            ...overrides
        } as unknown as KovaaksApiService;
    }


    private static _createIdentityService(overrides: Record<string, unknown> = {}): IdentityService {
        return {
            getDeviceId: vi.fn().mockReturnValue("test-device-id"),
            isAnalyticsEnabled: vi.fn().mockReturnValue(false),
            hasLinkedAccount: vi.fn().mockReturnValue(true),
            getActiveProfile: vi.fn().mockReturnValue({ username: "test", pfpUrl: "" }),
            getProfiles: vi.fn().mockReturnValue([]),
            addProfile: vi.fn(),
            setActiveProfile: vi.fn(),
            removeProfile: vi.fn(),
            onProfilesChanged: vi.fn(),
            canShowAnalyticsPrompt: vi.fn().mockReturnValue(false),
            recordAnalyticsPrompt: vi.fn(),
            ...overrides
        } as unknown as IdentityService;
    }


    private static _createRankedSession(overrides: Record<string, unknown> = {}): RankedSessionService {
        return {
            state: {
                status: "IDLE",
                sequence: ["Scenario A"],
                currentIndex: 0,
                initialEstimates: {},
                previousSessionRanks: {},
                accumulatedScenarioSeconds: {},
                playedScenarios: []
            },
            currentScenarioName: "Scenario A",
            onStateChanged: vi.fn(),
            advance: vi.fn(),
            extendSession: vi.fn(),
            endSession: vi.fn(),
            retreat: vi.fn(),
            startSession: vi.fn(),
            ...overrides
        } as unknown as RankedSessionService;
    }


    private static _createRankService(overrides: Record<string, unknown> = {}): RankService {
        return {
            calculateRank: vi.fn().mockReturnValue({ currentRank: "Silver", color: "var(--lower-band-3)", progressPercentage: 50 }),
            ...overrides
        } as unknown as RankService;
    }


    private static _createSessionSettingsService(overrides: Record<string, unknown> = {}): SessionSettingsService {
        return {
            getSettings: vi.fn(() => ({})),
            subscribe: vi.fn(),
            ...overrides
        } as unknown as SessionSettingsService;
    }



    private static _createCosmeticOverride(overrides: Record<string, unknown> = {}): CosmeticOverrideService {
        return {
            isActiveFor: vi.fn().mockReturnValue(false),
            getFakeEstimatedRank: vi.fn().mockReturnValue({ rankName: "Bronze", progressToNext: 0, continuousValue: 0 }),
            getFakeRankResult: vi.fn().mockReturnValue({ currentRank: "Bronze", progressPercentage: 0 }),
            onStateChanged: vi.fn(),
            activate: vi.fn(),
            deactivate: vi.fn(),
            ...overrides
        } as unknown as CosmeticOverrideService;
    }
}
