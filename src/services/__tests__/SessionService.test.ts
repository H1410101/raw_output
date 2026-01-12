import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { SessionService } from "../SessionService";
import { RankService } from "../RankService";
import { SessionSettingsService } from "../SessionSettingsService";
import { BenchmarkScenario } from "../../data/benchmarks";

interface SessionMocks {
    mockRankService: { calculateRank: Mock };
    mockSettingsService: { subscribe: Mock };
    settingsCallback: (settings: { sessionTimeoutMinutes: number }) => void;
}

describe("SessionService Creation", (): void => {
    let service: SessionService;
    let mocks: SessionMocks;

    beforeEach((): void => {
        mocks = _initSessionTestEnv();
        service = _createSessionService(mocks);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("should create a new session on first run", (): void => {
        const now: number = Date.now();
        vi.setSystemTime(now);
        _registerFirstRun(service);
        expect(service.sessionId).toBe(`session_${now}`);
    });
});

describe("SessionService Persistence", (): void => {
    let service: SessionService;
    let mocks: SessionMocks;

    beforeEach((): void => {
        mocks = _initSessionTestEnv();
        service = _createSessionService(mocks);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("should persist and load from localStorage", (): void => {
        _registerFirstRun(service);
        const originalId: string | null = service.sessionId;
        const newInstance: SessionService = new SessionService(
            mocks.mockRankService as unknown as RankService,
            mocks.mockSettingsService as unknown as SessionSettingsService
        );
        expect(newInstance.sessionId).toBe(originalId);
    });
});

describe("SessionService Expiration", (): void => {
    let service: SessionService;

    beforeEach((): void => {
        const mocks: SessionMocks = _initSessionTestEnv();
        service = _createSessionService(mocks);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("should expire session after inactivity", (): void => {
        _registerFirstRun(service);
        vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
        expect(service.isSessionActive()).toBe(false);
    });

    it("should start a new session after expiration", (): void => {
        const start: number = Date.now();
        vi.setSystemTime(start);
        _registerFirstRun(service);
        const firstId: string | null = service.sessionId;
        vi.setSystemTime(start + 30 * 60 * 1000);
        _registerSecondRun(service);
        expect(service.sessionId).not.toBe(firstId);
    });
});

describe("SessionService Recovery", (): void => {
    let service: SessionService;
    let mocks: SessionMocks;

    beforeEach((): void => {
        mocks = _initSessionTestEnv();
        service = _createSessionService(mocks);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("should re-acquire if timeout increases", (): void => {
        _registerFirstRun(service);
        vi.advanceTimersByTime(15 * 60 * 1000);
        mocks.settingsCallback({ sessionTimeoutMinutes: 20 });
        expect(service.isSessionActive()).toBe(true);
    });
});

function _initSessionTestEnv(): SessionMocks {
    vi.useFakeTimers();
    localStorage.clear();

    return _setupSessionMocks();
}

function _createSessionService(mocks: SessionMocks): SessionService {
    return new SessionService(
        mocks.mockRankService as unknown as RankService,
        mocks.mockSettingsService as unknown as SessionSettingsService
    );
}

function _setupSessionMocks(): SessionMocks {
    let capturedCallback: (settings: { sessionTimeoutMinutes: number }) => void = (): void => { };
    const mockRankService = {
        calculateRank: vi.fn().mockReturnValue({ rankLevel: 1, progressPercentage: 50 })
    };
    const mockSettingsService = {
        subscribe: vi.fn().mockImplementation((callback: (settings: { sessionTimeoutMinutes: number }) => void): void => {
            capturedCallback = callback;
            callback({ sessionTimeoutMinutes: 10 });
        })
    };

    return {
        mockRankService,
        mockSettingsService,
        settingsCallback: (settings: { sessionTimeoutMinutes: number }): void => capturedCallback(settings)
    };
}

function _registerFirstRun(service: SessionService): void {
    service.registerRun({
        scenarioName: "Scenario A",
        score: 100,
        scenario: { name: "Scenario A" } as unknown as BenchmarkScenario,
        difficulty: "Medium"
    });
}

function _registerSecondRun(service: SessionService): void {
    service.registerRun({
        scenarioName: "Scenario B",
        score: 150,
        scenario: { name: "Scenario B" } as unknown as BenchmarkScenario,
        difficulty: "Medium"
    });
}
