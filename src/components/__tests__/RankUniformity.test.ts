import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BenchmarkView } from '../BenchmarkView';
import { RankedView } from '../RankedView';
import { RankEstimator } from '../../services/RankEstimator';

// Mock CSS variables since we are in JSDOM
const mockStyles = `
  :root {
    --lower-band-3: rgb(100, 100, 100);
    --lower-band-1: rgb(50, 50, 50);
  }
  .rank-name {
    color: var(--lower-band-3);
    font-weight: 700;
  }
  .unranked-text {
    color: var(--lower-band-1) !important;
    font-weight: 600;
  }
`;

describe('RankUniformity', () => {
    let container: HTMLElement;
    let mockServices: any;

    beforeEach(() => {
        // Mock document.fonts for JSDOM
        Object.defineProperty(document, 'fonts', {
            value: { status: 'loaded', ready: Promise.resolve() },
            configurable: true
        });

        container = document.createElement('div');
        document.body.appendChild(container);
        const style = document.createElement('style');
        style.innerHTML = mockStyles;
        document.head.appendChild(style);

        // Simple mocks for services
        const benchmarkService = {
            getScenarios: vi.fn((diff) => [{ name: 'Scenario A', category: 'Cat', subcategory: 'Sub', thresholds: { 'Bronze': 100 } }]),
            getAvailableDifficulties: vi.fn().mockReturnValue(['Advanced']),
            getRankNames: vi.fn().mockReturnValue(['Bronze', 'Silver', 'Gold']),
            getDifficulty: vi.fn().mockReturnValue('Advanced')
        };

        const rankEstimator = {
            getEstimateMap: vi.fn().mockReturnValue({
                'Scenario A': { continuousValue: 1.5, highestAchieved: 1.5, lastUpdated: new Date().toISOString() }
            }),
            getScenarioEstimate: vi.fn().mockReturnValue({ continuousValue: 1.5 }),
            calculateHolisticEstimateRank: vi.fn().mockReturnValue({ rankName: 'Silver', progressToNext: 50, continuousValue: 1.5 }),
            calculateOverallRank: vi.fn().mockReturnValue({ rankName: 'Silver', progressToNext: 50, continuousValue: 1.5 }),
            getEstimateForValue: vi.fn().mockReturnValue({ rankName: 'Silver', progressToNext: 50, continuousValue: 1.5 }),
            getScenarioContinuousValue: vi.fn().mockReturnValue(1.5),
            applyDailyDecay: vi.fn(),
            evolveScenarioEstimate: vi.fn()
        };

        const appState = {
            getBenchmarkDifficulty: vi.fn().mockReturnValue('Advanced'),
            getBenchmarkScrollTop: vi.fn().mockReturnValue(0),
            setBenchmarkDifficulty: vi.fn(),
            getIsFolderViewOpen: vi.fn().mockReturnValue(false),
            getIsSettingsMenuOpen: vi.fn().mockReturnValue(false),
            on: vi.fn(),
            off: vi.fn(),
            getTheme: vi.fn().mockReturnValue('dark')
        };

        const sessionService = {
            on: vi.fn(),
            off: vi.fn(),
            onSessionUpdated: vi.fn(),
            isSessionActive: vi.fn().mockReturnValue(false),
            getScenarioSessionBest: vi.fn().mockReturnValue({ bestScore: 110 }),
            getAllScenarioSessionBests: vi.fn().mockReturnValue([{ scenarioName: 'Scenario A', bestScore: 110 }]),
            sessionStartTimestamp: Date.now()
        };

        const historyService = {
            getHighscores: vi.fn().mockResolvedValue({ 'Scenario A': 120 }),
            getBatchHighscores: vi.fn().mockResolvedValue({ 'Scenario A': 120 }),
            getLastScores: vi.fn().mockResolvedValue([]),
            getLastCheckTimestamp: vi.fn().mockResolvedValue(1000),
            onHighscoreUpdated: vi.fn(),
            onScoreRecorded: vi.fn()
        };

        const rankService = {
            calculateRank: vi.fn().mockReturnValue({ currentRank: 'Silver', progressPercentage: 50 })
        };

        const visualSettings = {
            getSettings: vi.fn().mockReturnValue({
                showDotCloud: false,
                showAllTimeBest: true,
                showSessionBest: true,
                scenarioFontSize: 'Medium',
                uiScaling: 1,
                categorySpacing: 1
            }),
            on: vi.fn(),
            off: vi.fn(),
            subscribe: vi.fn()
        };

        const rankedSession = {
            state: { status: 'IDLE', sequence: [], currentIndex: 0 },
            currentScenarioName: 'Scenario A',
            on: vi.fn(),
            off: vi.fn(),
            onStateChanged: vi.fn()
        };

        mockServices = {
            benchmark: benchmarkService,
            history: historyService,
            rank: rankService,
            session: sessionService,
            visualSettings: visualSettings,
            audio: { playLight: vi.fn(), playHeavy: vi.fn() },
            appState: appState,
            rankEstimator: rankEstimator,
            estimator: rankEstimator, // For RankedView
            directory: { on: vi.fn(), currentFolderName: 'test' },
            folderActions: {},
            focus: { on: vi.fn(), subscribe: vi.fn(), getFocusState: vi.fn().mockReturnValue(null), clearFocus: vi.fn() },
            sessionSettings: { getSettings: vi.fn(() => ({})), subscribe: vi.fn() },
            cloudflare: {},
            identity: { on: vi.fn() },
            rankedSession: rankedSession
        };
    });

    afterEach(() => {
        if (container && container.parentNode) {
            document.body.removeChild(container);
        }
        document.head.querySelectorAll('style').forEach(s => s.remove());
    });

    const getComputedStyles = (el: HTMLElement) => {
        const styles = window.getComputedStyle(el);
        return {
            color: styles.color,
            fontWeight: styles.fontWeight
        };
    };

    const waitForSelector = async (selector: string): Promise<HTMLElement> => {
        for (let i = 0; i < 50; i++) {
            const el = container.querySelector(selector);
            if (el) return el as HTMLElement;
            await new Promise(r => setTimeout(r, 20));
        }
        throw new Error(`Timeout waiting for selector: ${selector}\nInner HTML: ${container.innerHTML.substring(0, 1000)}`);
    };

    it('should have consistent properties across all rank types', async () => {
        const bv = new BenchmarkView(container, mockServices, mockServices.appState);
        await bv.render();

        const allTimeRank = await waitForSelector('.rank-badge-container:not(.session-badge):not(.estimate-badge) .rank-name');
        const sessionRank = await waitForSelector('.session-badge .rank-name');
        const estimateRank = await waitForSelector('.estimate-badge .rank-name');
        const headerRank = await waitForSelector('.holistic-rank-container .rank-name');

        const standardColor = 'rgb(100, 100, 100)';
        const standardWeight = '700';

        [allTimeRank, sessionRank, estimateRank, headerRank].forEach(el => {
            const style = getComputedStyles(el);
            expect(style.color).toBe(standardColor);
            expect(style.fontWeight).toBe(standardWeight);
        });

        // HUD Ranks
        container.innerHTML = '';
        mockServices.rankedSession.state.status = 'ACTIVE';
        mockServices.rankedSession.state.sequence = ['Scenario A'];
        mockServices.session.isSessionActive.mockReturnValue(true);
        const rv = new RankedView(container, mockServices);
        await rv.render();

        const targetRank = await waitForSelector('.stat-item.highlight .rank-name');
        const achievedRank = await waitForSelector('.stat-item:not(.highlight) .rank-name');

        [targetRank, achievedRank].forEach(el => {
            const style = getComputedStyles(el);
            expect(style.color).toBe(standardColor);
            expect(style.fontWeight).toBe(standardWeight);
        });
    });

    it('should have consistent properties for Unranked state', async () => {
        mockServices.rankEstimator.getEstimateMap.mockReturnValue({});
        mockServices.rankEstimator.calculateHolisticEstimateRank.mockReturnValue({ rankName: 'Unranked', progressToNext: 0, continuousValue: 0 });
        mockServices.rankEstimator.getEstimateForValue.mockReturnValue({ rankName: 'Unranked', progressToNext: 0, continuousValue: 0 });
        mockServices.rankEstimator.calculateOverallRank.mockReturnValue({ rankName: 'Unranked', progressToNext: 0, continuousValue: 0 });

        mockServices.history.getHighscores.mockResolvedValue({});
        mockServices.history.getBatchHighscores.mockResolvedValue({});
        mockServices.session.getScenarioSessionBest.mockReturnValue(null);
        mockServices.rank.calculateRank.mockReturnValue({ currentRank: 'Unranked', progressPercentage: 0 });

        const bv = new BenchmarkView(container, mockServices, mockServices.appState);
        await bv.render();

        const allTimeRank = await waitForSelector('.rank-badge-container:not(.session-badge):not(.estimate-badge) .rank-name');
        const headerRank = await waitForSelector('.holistic-rank-container .rank-name');

        const unrankedColor = 'rgb(50, 50, 50)';
        const unrankedWeight = '600';

        expect(getComputedStyles(allTimeRank).color).toBe(unrankedColor);
        expect(getComputedStyles(allTimeRank).fontWeight).toBe(unrankedWeight);
        expect(getComputedStyles(headerRank).color).toBe(unrankedColor);
        expect(getComputedStyles(headerRank).fontWeight).toBe(unrankedWeight);

        container.innerHTML = '';
        mockServices.rankedSession.state.status = 'ACTIVE';
        mockServices.rankedSession.state.sequence = ['Scenario A'];
        mockServices.session.getAllScenarioSessionBests.mockReturnValue([]);
        mockServices.session.isSessionActive.mockReturnValue(true);
        const rv = new RankedView(container, mockServices);
        await rv.render();

        const achievedRank = await waitForSelector('.stat-item:not(.highlight) .rank-name');
        expect(getComputedStyles(achievedRank).color).toBe(unrankedColor);
        expect(getComputedStyles(achievedRank).fontWeight).toBe(unrankedWeight);
    });
});
