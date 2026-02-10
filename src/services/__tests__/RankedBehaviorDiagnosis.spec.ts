/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RankedSessionService } from '../RankedSessionService';
import { SessionService } from '../SessionService';
import { RankEstimator } from '../RankEstimator';
import { BenchmarkService } from '../BenchmarkService';
import { SessionSettingsService } from '../SessionSettingsService';
import { RankService } from '../RankService';
import { BenchmarkScenario } from '../../data/benchmarks';

// Mock dependencies
const mockLocalStorage = ((): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void; clear: () => void } => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string): string | null => store[key] || null,
        setItem: (key: string, value: string): void => { store[key] = value.toString(); },
        removeItem: (key: string): void => { delete store[key]; },
        clear: (): void => { store = {}; }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

// Mock Benchmark Data
const mockScenarios: BenchmarkScenario[] = [
    { name: 'Scenario_A', category: 'Clicking', subcategory: 'Static', thresholds: { 'Bronze': 100, 'Silver': 200 } },
    { name: 'Scenario_B', category: 'Tracking', subcategory: 'Smooth', thresholds: { 'Bronze': 100, 'Silver': 200 } },
    { name: 'Scenario_C', category: 'Switching', subcategory: 'Evasive', thresholds: { 'Bronze': 100, 'Silver': 200 } },
    { name: 'Scenario_Unselected', category: 'Clicking', subcategory: 'Dynamic', thresholds: { 'Bronze': 100, 'Silver': 200 } }
];

const mockBenchmarkService = {
    getScenarios: vi.fn().mockReturnValue(mockScenarios),
    getRankNames: vi.fn().mockReturnValue(['Bronze', 'Silver', 'Gold']),
    getDifficulty: vi.fn().mockReturnValue('Intermediate'),
    getAvailableDifficulties: vi.fn().mockReturnValue(['Intermediate']),
} as unknown as BenchmarkService;


class FakeRankedView {
    public constructor(
        private readonly _rankedSession: RankedSessionService
    ) {
        // New Architecture: View is passive regarding rank evolution.
        // It listens only to re-render, not to trigger logic.
        this._rankedSession.onStateChanged(() => { });
    }

    // handleSessionUpdate removed as it is no longer responsible for evolution.
}

// eslint-disable-next-line max-lines-per-function
describe('Ranked Session Diagnosis', () => {
    let sessionService: SessionService;
    let rankedSessionService: RankedSessionService;
    let rankEstimator: RankEstimator;
    beforeEach(() => {
        mockLocalStorage.clear();
        vi.useFakeTimers();

        const sessionSettings = {
            subscribe: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60, sessionTimeoutMinutes: 10 })
        } as unknown as SessionSettingsService;

        const rankService = new RankService();
        sessionService = new SessionService(rankService, sessionSettings);
        rankEstimator = new RankEstimator(mockBenchmarkService);
        rankedSessionService = new RankedSessionService(
            mockBenchmarkService,
            sessionService,
            rankEstimator,
            sessionSettings
        );

        // Initialize estimates to 0
        const initialEstimates: Record<string, { continuousValue: number; highestAchieved: number; lastUpdated: string }> = {};
        mockScenarios.forEach((scenario) => {
            initialEstimates[scenario.name] = { continuousValue: 0, highestAchieved: 0, lastUpdated: new Date().toISOString() };
        });
        localStorage.setItem('rank_identity_state_v2', JSON.stringify(initialEstimates));

        // Instantiate "View" which attaches listeners
        new FakeRankedView(rankedSessionService);
    });


    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('Diagnose: Rank Updates should NOT happen immediately during ACTIVE session', () => {
        // 1. Start Session
        rankedSessionService.startSession('Intermediate');
        const currentScenario = rankedSessionService.currentScenarioName;
        expect(currentScenario).toBeDefined();

        // 2. Initial Estimate
        const initialEstimate = rankEstimator.getScenarioEstimate(currentScenario!).continuousValue;

        // 3. Play the current scenario (Register Run)
        // Score 150 (Silver is 200, Bronze 100). Should give decent rank unit.
        // We need 3 runs for the rank to count (Strict 3rd logic).
        for (let i = 0; i < 3; i++) {
            sessionService.registerRun({
                scenarioName: currentScenario!,
                score: 150,
                scenario: mockScenarios.find((ref) => ref.name === currentScenario)!,
                difficulty: 'Intermediate',
                timestamp: new Date()
            });
            vi.advanceTimersByTime(1000);
        }

        // 4. Check Estimate
        const newEstimate = rankEstimator.getScenarioEstimate(currentScenario!).continuousValue;

        // DIAGNOSIS: The current implementation updates immediately.
        // We assert that it DOES NOT update (Desired Behavior).
        // If this fails, it confirms the issue.
        expect(newEstimate).toBe(initialEstimate);

        // 5. End Session
        rankedSessionService.endSession();

        // 6. Verify Update Happened AFTER end
        const finalEstimate = rankEstimator.getScenarioEstimate(currentScenario!).continuousValue;

        // Should have increased!
        expect(finalEstimate).toBeGreaterThan(initialEstimate);
    });

    it('Diagnose: Unselected scenarios should NOT trigger rank updates (or side effects)', () => {
        rankedSessionService.startSession('Intermediate');
        const currentScenario = rankedSessionService.currentScenarioName!;

        // Ensure we have a baseline score for the current scenario
        // (Simulate we played it once already)
        sessionService.registerRun({
            scenarioName: currentScenario,
            score: 150,
            scenario: mockScenarios.find((ref) => ref.name === currentScenario)!,
            difficulty: 'Intermediate',
            timestamp: new Date()
        });

        // Capture estimate after first play
        const estimateAfterFirstPlay = rankEstimator.getScenarioEstimate(currentScenario).continuousValue;

        // Check local storage to bypass any caching? RankEstimator reads from localStorage every time.

        // Now play an UNSELECTED scenario
        sessionService.registerRun({
            scenarioName: 'Scenario_Unselected',
            score: 200,
            scenario: mockScenarios.find((ref) => ref.name === 'Scenario_Unselected')!,
            difficulty: 'Intermediate',
            timestamp: new Date()
        });

        // DIAGNOSIS:
        // Playing "Unselected" triggers SessionService update.
        // FakeRankedView listener fires.
        // It sees "currentScenario" (Scenario_A) is in session bests.
        // It calls "evolveEstimate" for Scenario_A AGAIN.
        // Effect: The estimate for Scenario_A changes simply because we played Unselected.
        const estimateAfterUnrelatedPlay = rankEstimator.getScenarioEstimate(currentScenario).continuousValue;

        // Expect NO change.
        expect(estimateAfterUnrelatedPlay).toBe(estimateAfterFirstPlay);
    });

    it('Diagnose: New Ranked Session should be independent (Rank Logic)', () => {
        // 1. Play Session 1
        rankedSessionService.startSession('Intermediate');
        const s1_scenario = rankedSessionService.currentScenarioName!;

        // Play it
        sessionService.registerRun({
            scenarioName: s1_scenario,
            score: 150,
            scenario: mockScenarios.find((ref) => ref.name === s1_scenario)!,
            difficulty: 'Intermediate',
            timestamp: new Date()
        });

        // End Session 1
        rankedSessionService.reset();

        // 2. Start Session 2 immediately
        // (SessionService still holds the bests because timeout hasn't passed)
        rankedSessionService.startSession('Intermediate');
        // Likely slightly randomized or same
        const s2_scenario = rankedSessionService.currentScenarioName!;

        // Assume s2_scenario is the same as s1_scenario for this test case (determinism or luck)
        // We can force it by mocking the sequence if needed, but here we just check if *whatever* is current gets updated.

        const estimateAtStartOfS2 = rankEstimator.getScenarioEstimate(s2_scenario).continuousValue;

        // We haven't played anything in S2 yet!
        // But if s2_scenario was played in S1, it is in SessionService bests.

        // Trigger a dummy update (e.g. some other component updates session, or we play a different scenario)
        // Or simply, does the start of a session trigger an update? 
        // No, startSession notifies state change, View refreshes. View does NOT call handleSessionUpdate on render.
        // But if we play *anything* (e.g. the first scenario of S2), 
        // we want to ensure we don't carry over S1's score IF that's what "New Ranked Session" implies.

        // User said: "if I end a ranked run and start a new one immediately after, that is a new ranked session, but should be the same benchmark session."
        // "Make sure both ranks update correctly".

        // This suggests that reusing the score is VALID for the Benchmark Session, but maybe specific Ranked Session logic needs to be careful?
        // If I use a score from 5 minutes ago (previous run), did I really "play" this run?
        // Usually NO.

        // So I'll assert that `hasPlayedCurrent()` should ideally be false? 
        // RankedSessionService uses `sessionService.getAllScenarioSessionBests()`.
        // If SessionService is shared, `hasPlayedCurrent` is TRUE.

        // If `hasPlayedCurrent` is true, does it mean the step is skipped? Autoskipped? 
        // The current code does NOT auto-skip.
        // It relies on the user playing.

        // But if I play *again* to improve, that's fine.
        // If I just let it sit, nothing happens.

        // The issue is if I play *Scenario B* (2nd in sequence), does it Count Scenario A (1st) as "Done" with old score?
        // The UI might show it as "Improved" if the old score was good.

        // The specific 'bad' behavior would be updating the Rank immediately using the OLD score.
        // Trigger a session update by playing Scenario B.
        // Current is Scenario A. Old score exists.
        // View updates Rank for Scenario A using Old Score.

        // If the user wants independence, this ghost update shouldn't happen.

        // Assert: S1 score should NOT be used to update S2 rank simply because S2 is active.

        // Workaround to test: Play Scenario B (Unselected/Next).
        const otherScenario = mockScenarios.find((ref) => ref.name !== s2_scenario)!.name;
        sessionService.registerRun({
            scenarioName: otherScenario,
            score: 100,
            scenario: mockScenarios.find((ref) => ref.name === otherScenario)!,
            difficulty: 'Intermediate',
            timestamp: new Date()
        });

        const estimateAfterS2Update = rankEstimator.getScenarioEstimate(s2_scenario).continuousValue;

        // If independent, S2 shouldn't just grab S1's score and evolve rank again.
        expect(estimateAfterS2Update).toBe(estimateAtStartOfS2);
    });
});
