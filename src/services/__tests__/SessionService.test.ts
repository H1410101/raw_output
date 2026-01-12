import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionService } from '../SessionService';
import { RankService } from '../RankService';
import { SessionSettingsService } from '../SessionSettingsService';

describe('SessionService', () => {
    let sessionService: SessionService;
    let mockRankService: any;
    let mockSettingsService: any;
    let settingsCallback: (settings: any) => void;

    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();

        // 1. Mock RankService
        mockRankService = {
            calculateRank: vi.fn().mockReturnValue({ rankLevel: 1, progressPercentage: 50 })
        };

        // 2. Mock SessionSettingsService
        mockSettingsService = {
            subscribe: vi.fn().mockImplementation((cb) => {
                settingsCallback = cb;
                cb({ sessionTimeoutMinutes: 10 }); // Default
            })
        };

        sessionService = new SessionService(
            mockRankService as unknown as RankService,
            mockSettingsService as unknown as SessionSettingsService
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should create a new session on first run (session.logic.int.id)', () => {
        const now = Date.now();
        vi.setSystemTime(now);

        sessionService.registerRun({
            scenarioName: 'Scenario A',
            score: 100,
            scenario: { name: 'Scenario A' } as any,
            difficulty: 'Medium'
        });

        expect(sessionService.sessionId).toBe(`session_${now}`);
        expect(sessionService.isSessionActive()).toBe(true);
    });

    it('should expire session after inactivity (session.logic.ext.badge_expiration)', () => {
        sessionService.registerRun({
            scenarioName: 'Scenario A',
            score: 100,
            scenario: { name: 'Scenario A' } as any,
            difficulty: 'Medium'
        });

        expect(sessionService.isSessionActive()).toBe(true);

        // Advance time by 10 minutes and 1 second
        vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

        expect(sessionService.isSessionActive()).toBe(false);
    });

    it('should start a new session if run is recorded after expiration', () => {
        const start = Date.now();
        vi.setSystemTime(start);

        sessionService.registerRun({
            scenarioName: 'Scenario A',
            score: 100,
            scenario: { name: 'Scenario A' } as any,
            difficulty: 'Medium'
        });

        const firstId = sessionService.sessionId;

        // Advance far into future
        const later = start + 30 * 60 * 1000;
        vi.setSystemTime(later);

        sessionService.registerRun({
            scenarioName: 'Scenario B',
            score: 150,
            scenario: { name: 'Scenario B' } as any,
            difficulty: 'Medium'
        });

        expect(sessionService.sessionId).not.toBe(firstId);
        expect(sessionService.sessionId).toBe(`session_${later}`);
    });

    it('should re-acquire old session if timeout is increased (session.logic.int.preservation)', () => {
        const start = Date.now();
        vi.setSystemTime(start);

        sessionService.registerRun({
            scenarioName: 'Scenario A',
            score: 100,
            scenario: { name: 'Scenario A' } as any,
            difficulty: 'Medium'
        });

        // Wait 15 minutes (default timeout is 10)
        vi.advanceTimersByTime(15 * 60 * 1000);
        expect(sessionService.isSessionActive()).toBe(false);

        // Simulate settings change to 20 minutes
        settingsCallback({ sessionTimeoutMinutes: 20 });

        // Now it should be active again because the last run (15 mins ago) is within the 20 min window
        expect(sessionService.isSessionActive()).toBe(true);
    });

    it('should persist and load from localStorage', () => {
        sessionService.registerRun({
            scenarioName: 'Scenario A',
            score: 100,
            scenario: { name: 'Scenario A' } as any,
            difficulty: 'Medium'
        });

        const originalId = sessionService.sessionId;

        // Create a new instance, it should load from localStorage
        const newInstance = new SessionService(
            mockRankService as unknown as RankService,
            mockSettingsService as unknown as SessionSettingsService
        );

        expect(newInstance.sessionId).toBe(originalId);
        expect(newInstance.getScenarioSessionBest('Scenario A')).not.toBeNull();
    });
});
