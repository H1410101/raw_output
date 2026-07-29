import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSyncDependencies, SessionSyncService } from "../SessionSyncService";
import { SessionRankRecord } from "../SessionService";
import { IdentityService } from "../IdentityService";
import { CloudflareSyncError } from "../CloudflareService";
import type { RankedSessionState } from "../RankedSessionService";
import type { SessionSyncPayload } from "../../types/SessionSyncTypes";

const OUTBOX_KEY = "sync_outbox";
const FIRST_SESSION_START = Date.UTC(2026, 6, 29, 23, 55);

beforeEach((): void => {
    localStorage.clear();
});

afterEach((): void => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

interface DeferredSend {
    readonly promise: Promise<void>;
    readonly resolve: () => void;
}

interface SyncHarness {
    readonly sendSync: ReturnType<typeof vi.fn>;
    readonly getDeviceId: ReturnType<typeof vi.fn>;
    readonly setConsent: (enabled: boolean) => void;
    readonly changeSession: (sessionId: string, scenarioName: string) => void;
    readonly expireSession: () => void;
    readonly reactivateSession: () => void;
    readonly resetSession: () => void;
    readonly startSession: (sessionId: string, startTimestamp: number, runs: SessionRankRecord[]) => void;
    readonly setRankedState: (state: RankedSessionState) => void;
    readonly switchProfile: (sessionId: string, startTimestamp: number, runs: SessionRankRecord[]) => void;
}

type HarnessActions = Omit<SyncHarness, "sendSync" | "getDeviceId">;

interface HarnessOptions {
    readonly sessionId?: string;
    readonly sessionStartTimestamp?: number;
    readonly runs?: SessionRankRecord[];
    readonly rankedRuns?: RankedAttempt[];
    readonly rankedState?: RankedSessionState;
    readonly active?: boolean;
    readonly availableDifficulties?: string[];
    readonly profileUsername?: string | null;
}

interface RankedAttempt {
    readonly scenarioName: string;
    readonly score: number;
    readonly timestamp: number;
}

describe("SessionSyncService outbox privacy", (): void => {
    it("purges a persisted outbox on an opted-out reload", async (): Promise<void> => {
        localStorage.setItem(OUTBOX_KEY, JSON.stringify([_payload("persisted-session")]));

        const harness = _createHarness(false);
        await Promise.resolve();

        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
        expect(harness.sendSync).not.toHaveBeenCalled();
        expect(harness.getDeviceId).not.toHaveBeenCalled();
    });

    it("receives opt-out notifications from IdentityService", (): void => {
        localStorage.setItem("raw_output_analytics_consent", "true");
        const identityService = new IdentityService();
        const listener = vi.fn();
        identityService.onAnalyticsConsentChanged(listener);

        identityService.setAnalyticsConsent(false);

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(false);
        expect(identityService.isAnalyticsEnabled()).toBe(false);
    });
});

describe("SessionSyncService outbox consent changes", (): void => {
    it("purges on opt-out and gates every remaining send", async (): Promise<void> => {
        const deferred = _deferredSend();
        const sendSync = vi.fn()
            .mockImplementationOnce((): Promise<void> => deferred.promise)
            .mockResolvedValue(undefined);
        localStorage.setItem(OUTBOX_KEY, JSON.stringify([
            _payload("first-session"),
            _payload("second-session"),
        ]));

        const harness = _createHarness(true, sendSync);
        await vi.waitFor((): void => expect(sendSync).toHaveBeenCalledTimes(1));
        harness.setConsent(false);

        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
        deferred.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendSync).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    });

    it("removes corrupt outbox JSON without attempting a send", async (): Promise<void> => {
        localStorage.setItem(OUTBOX_KEY, "{broken-json");

        const harness = _createHarness(true);
        await Promise.resolve();

        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
        expect(harness.sendSync).not.toHaveBeenCalled();
    });
});

describe("SessionSyncService outbox serialization", (): void => {
    it("retains an enqueue during a send and drains each payload once", async (): Promise<void> => {
        const deferred = _deferredSend();
        const sendSync = vi.fn()
            .mockImplementationOnce((): Promise<void> => deferred.promise)
            .mockResolvedValue(undefined);
        const harness = _createHarness(true, sendSync);

        harness.changeSession("session-2", "Scenario B");
        await vi.waitFor((): void => expect(sendSync).toHaveBeenCalledTimes(1));

        harness.changeSession("session-3", "Scenario C");
        await Promise.resolve();
        expect(sendSync).toHaveBeenCalledTimes(1);
        expect(_storedSessionIds()).toEqual(["session-1", "session-2"]);

        deferred.resolve();
        await vi.waitFor((): void => {
            expect(sendSync).toHaveBeenCalledTimes(2);
            expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
        });

        const sentPayloads = sendSync.mock.calls.map((call: unknown[]): SessionSyncPayload =>
            call[0] as SessionSyncPayload);
        expect(sentPayloads.map((payload: SessionSyncPayload): string => payload.sessionId))
            .toEqual(["session-1", "session-2"]);
    });

    it("drops a permanently rejected payload and continues draining", _skipsPermanentFailure);
    it("migrates legacy ranked IDs before sending", _migratesLegacyRankedId);
});

async function _skipsPermanentFailure(): Promise<void> {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([
        _payload("invalid-session"),
        _payload("valid-session"),
    ]));
    const sendSync = vi.fn()
        .mockRejectedValueOnce(new CloudflareSyncError("invalid", 400))
        .mockResolvedValueOnce(undefined);

    _createHarness(true, sendSync);

    await vi.waitFor((): void => expect(sendSync).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
}

async function _migratesLegacyRankedId(): Promise<void> {
    const legacyPayload: SessionSyncPayload = {
        ..._payload("legacy-ranked"),
        isRanked: true,
        rankedSessionId: FIRST_SESSION_START,
        difficulty: "Medium",
        triedAll: false,
        runs: [{
            scenarioName: "Scenario A",
            bestScore: 1000,
            isRankedRun: true,
            targetRankUnits: 10,
            endRankUnits: 12,
            highscoreRankUnits: 11,
            scores: [900],
        }],
    };
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([legacyPayload]));

    const harness = _createHarness(true);

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledOnce());
    expect(_sentPayloads(harness.sendSync)[0].rankedSessionId).toBe(FIRST_SESSION_START * 1_000 + 1);
}

describe("SessionSyncService retry lifecycle", (): void => {
    it("retries a failed outbox send without requiring another user action", async (): Promise<void> => {
        vi.useFakeTimers();
        const sendSync = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(undefined);
        const harness = _createHarness(true, sendSync);

        harness.changeSession("session-2", "Scenario B");
        await vi.advanceTimersByTimeAsync(0);

        expect(sendSync).toHaveBeenCalledOnce();
        expect(_storedSessionIds()).toEqual(["session-1"]);

        await vi.advanceTimersByTimeAsync(4_999);
        expect(sendSync).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1);
        expect(sendSync).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    });
});

describe("SessionSyncService session snapshots", (): void => {
    it("queues an expired session without waiting for another run", _queuesExpiredSession);
    it("does not duplicate expiry and can expire after reactivation", _handlesExpiryTransitions);
    it("preserves the original UTC date when reset crosses midnight", _preservesDateAcrossReset);
    it("does not carry ranked metadata into the next ordinary session", _isolatesOrdinarySession);
    it("marks only ranked scenarios and uses ranked attempts for highscore units", _mapsMixedSession);
    it("waits for both profile-scoped services before capturing a switched profile", _isolatesProfileSwitch);
    it("uses distinct telemetry IDs for difficulties in the same daily session", _separatesDifficulties);
});

async function _queuesExpiredSession(): Promise<void> {
    const harness = _createHarness(true);

    harness.expireSession();

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledOnce());
    expect(_sentPayloads(harness.sendSync)[0].sessionId).toBe("session-1");
}

async function _handlesExpiryTransitions(): Promise<void> {
    const harness = _createHarness(true);

    harness.expireSession();
    await vi.waitFor((): void => {
        expect(harness.sendSync).toHaveBeenCalledOnce();
        expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    });

    harness.expireSession();
    await Promise.resolve();
    expect(harness.sendSync).toHaveBeenCalledOnce();

    harness.reactivateSession();
    harness.expireSession();
    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledTimes(2));
}

async function _preservesDateAcrossReset(): Promise<void> {
    const harness = _createHarness(true, undefined, { sessionStartTimestamp: FIRST_SESSION_START });

    harness.resetSession();
    harness.startSession("session-2", Date.UTC(2026, 6, 30, 0, 5), [_run("Scenario B")]);

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledOnce());
    expect(_sentPayloads(harness.sendSync)[0]).toMatchObject({
        sessionId: "session-1",
        sessionDate: "2026-07-29",
        runs: [{ scenarioName: "Scenario A", bestScore: 1000 }],
    });
}

async function _isolatesOrdinarySession(): Promise<void> {
    const harness = _createRankedHarness(
        "Ranked Scenario",
        [_run("Ranked Scenario", 1200)],
        [{ scenarioName: "Ranked Scenario", score: 1000, timestamp: FIRST_SESSION_START + 1_000 }],
    );

    harness.resetSession();
    harness.setRankedState(_rankedState());
    harness.startSession("ordinary-session", FIRST_SESSION_START + 24 * 60 * 60 * 1000, [
        _run("Ordinary Scenario", 800),
    ]);
    harness.expireSession();

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledTimes(2));
    _expectRankedThenOrdinary(_sentPayloads(harness.sendSync));
}

async function _mapsMixedSession(): Promise<void> {
    const harness = _createRankedHarness(
        "Mixed Scenario",
        [_run("Mixed Scenario", 1500), _run("Ordinary Scenario", 2000)],
        [
            { scenarioName: "Mixed Scenario", score: 900, timestamp: FIRST_SESSION_START + 1_000 },
            { scenarioName: "Mixed Scenario", score: 1000, timestamp: FIRST_SESSION_START + 2_000 },
            { scenarioName: "Mixed Scenario", score: 950, timestamp: FIRST_SESSION_START + 3_000 },
            { scenarioName: "Mixed Scenario", score: 1200, timestamp: FIRST_SESSION_START + 4_000 },
        ],
    );

    harness.expireSession();

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledOnce());
    const payload = _sentPayloads(harness.sendSync)[0];
    expect(payload.isRanked).toBe(true);
    expect(payload.runs).toEqual(_expectedMixedRuns());
}

async function _isolatesProfileSwitch(): Promise<void> {
    const harness = _createRankedHarness(
        "Old Ranked Scenario",
        [_run("Old Ranked Scenario", 1200)],
        [{ scenarioName: "Old Ranked Scenario", score: 1100, timestamp: FIRST_SESSION_START + 1_000 }],
    );

    harness.switchProfile(
        "session-1",
        FIRST_SESSION_START + 60_000,
        [_run("New Ordinary Scenario", 800)],
    );
    await Promise.resolve();
    harness.expireSession();

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledTimes(2));
    const [oldPayload, newPayload] = _sentPayloads(harness.sendSync);
    expect(oldPayload.isRanked).toBe(true);
    expect(newPayload).toMatchObject({
        sessionId: "session-1",
        isRanked: false,
        runs: [{ scenarioName: "New Ordinary Scenario", bestScore: 800 }],
    });
}

async function _separatesDifficulties(): Promise<void> {
    const mediumState: RankedSessionState = _activeRankedState("Shared Scenario");
    const harness = _createHarness(true, undefined, {
        sessionStartTimestamp: FIRST_SESSION_START,
        runs: [_run("Shared Scenario", 1200)],
        rankedRuns: [{ scenarioName: "Shared Scenario", score: 1100, timestamp: FIRST_SESSION_START + 1_000 }],
        rankedState: mediumState,
        availableDifficulties: ["Medium", "Hard"],
    });

    harness.setRankedState({ ...mediumState, status: "SUMMARY" });
    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledOnce());
    harness.setRankedState({ ...mediumState, difficulty: "Hard", status: "ACTIVE" });
    harness.setRankedState({ ...mediumState, difficulty: "Hard", status: "SUMMARY" });

    await vi.waitFor((): void => expect(harness.sendSync).toHaveBeenCalledTimes(2));
    expect(_sentPayloads(harness.sendSync).map((payload: SessionSyncPayload): number | null | undefined =>
        payload.rankedSessionId)).toEqual([
        FIRST_SESSION_START * 1_000 + 1,
        FIRST_SESSION_START * 1_000 + 2,
    ]);
}

function _createRankedHarness(
    scenarioName: string,
    runs: SessionRankRecord[],
    rankedRuns: RankedAttempt[],
): SyncHarness {
    return _createHarness(true, undefined, {
        sessionStartTimestamp: FIRST_SESSION_START,
        runs,
        rankedRuns,
        rankedState: _activeRankedState(scenarioName),
    });
}

function _expectRankedThenOrdinary(payloads: SessionSyncPayload[]): void {
    const [rankedPayload, ordinaryPayload] = payloads;

    expect(rankedPayload.isRanked).toBe(true);
    expect(ordinaryPayload).toEqual({
        deviceId: "anonymous-device",
        sessionId: "ordinary-session",
        sessionDate: "2026-07-30",
        isRanked: false,
        runs: [{ scenarioName: "Ordinary Scenario", bestScore: 800 }],
    });
}

function _expectedMixedRuns(): SessionSyncPayload["runs"] {
    return [
        {
            scenarioName: "Mixed Scenario",
            bestScore: 1500,
            isRankedRun: true,
            targetRankUnits: 10,
            endRankUnits: 25,
            highscoreRankUnits: 12,
            scores: [900, 1000, 950],
        },
        { scenarioName: "Ordinary Scenario", bestScore: 2000 },
    ];
}

function _createHarness(
    initialConsent: boolean,
    sendSync: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
    options: HarnessOptions = {},
): SyncHarness {
    const state: HarnessState = _createHarnessState(initialConsent, options);
    new SessionSyncService(_createDependencies(state, sendSync));

    return { sendSync, getDeviceId: state.getDeviceId, ..._createHarnessActions(state) };
}

function _createHarnessState(initialConsent: boolean, options: HarnessOptions): HarnessState {
    return {
        sessionId: options.sessionId ?? "session-1",
        sessionStartTimestamp: options.sessionStartTimestamp ?? FIRST_SESSION_START,
        runs: options.runs ?? [_run("Scenario A")],
        rankedRuns: options.rankedRuns ?? [],
        rankedState: options.rankedState ?? _rankedState(),
        active: options.active ?? true,
        sessionListener: (): void => undefined,
        rankedListener: (): void => undefined,
        consentListener: (): void => undefined,
        consent: initialConsent,
        getDeviceId: vi.fn((): string => "anonymous-device"),
        availableDifficulties: options.availableDifficulties ?? ["Medium"],
        profileUsername: options.profileUsername ?? "profile-one",
    };
}

function _createHarnessActions(state: HarnessState): HarnessActions {
    return {
        setConsent: (enabled: boolean): void => _setConsent(state, enabled),
        changeSession: (sessionId: string, scenarioName: string): void =>
            _changeSession(state, sessionId, scenarioName),
        expireSession: (): void => _setSessionActive(state, false),
        reactivateSession: (): void => _setSessionActive(state, true),
        resetSession: (): void => _resetSession(state),
        startSession: (sessionId: string, startTimestamp: number, runs: SessionRankRecord[]): void =>
            _startSession(state, sessionId, startTimestamp, runs),
        setRankedState: (rankedState: RankedSessionState): void => _setRankedState(state, rankedState),
        switchProfile: (sessionId: string, startTimestamp: number, runs: SessionRankRecord[]): void =>
            _switchProfile(state, sessionId, startTimestamp, runs),
    };
}

function _setConsent(state: HarnessState, enabled: boolean): void {
    state.consent = enabled;
    state.consentListener(enabled);
}

function _changeSession(state: HarnessState, sessionId: string, scenarioName: string): void {
    state.sessionId = sessionId;
    state.sessionStartTimestamp = (state.sessionStartTimestamp ?? FIRST_SESSION_START) + 60_000;
    state.runs = [_run(scenarioName)];
    state.rankedRuns = [];
    state.active = true;
    state.sessionListener();
}

function _setSessionActive(state: HarnessState, active: boolean): void {
    state.active = active;
    state.sessionListener();
}

function _resetSession(state: HarnessState): void {
    state.sessionId = null;
    state.sessionStartTimestamp = null;
    state.runs = [];
    state.active = false;
    state.sessionListener();
}

function _startSession(
    state: HarnessState,
    sessionId: string,
    startTimestamp: number,
    runs: SessionRankRecord[],
): void {
    state.sessionId = sessionId;
    state.sessionStartTimestamp = startTimestamp;
    state.runs = runs;
    state.active = true;
    state.sessionListener();
}

function _setRankedState(state: HarnessState, rankedState: RankedSessionState): void {
    state.rankedState = rankedState;
    state.rankedListener();
}

function _switchProfile(
    state: HarnessState,
    sessionId: string,
    startTimestamp: number,
    runs: SessionRankRecord[],
): void {
    state.profileUsername = "profile-two";
    state.sessionId = sessionId;
    state.sessionStartTimestamp = startTimestamp;
    state.runs = runs;
    state.rankedRuns = [];
    state.active = true;
    state.sessionListener();
    state.rankedState = _rankedState();
    state.rankedListener();
}

function _createDependencies(
    state: HarnessState,
    sendSync: ReturnType<typeof vi.fn>,
): SessionSyncDependencies {
    const dependencies = {
        sessionService: _createSessionDependency(state),
        rankedSessionService: _createRankedDependency(state),
        identityService: _createIdentityDependency(state),
        cloudflareService: { sendSync },
        rankEstimator: {
            getScenarioEstimate: vi.fn(() => ({ continuousValue: 25 })),
            getScenarioContinuousValue: vi.fn((score: number): number => score / 100),
        },
        benchmarkService: _createBenchmarkDependency(state),
    } as unknown as SessionSyncDependencies;

    return dependencies;
}

function _createSessionDependency(state: HarnessState): object {
    return {
        get sessionId(): string | null { return state.sessionId; },
        get sessionStartTimestamp(): number | null { return state.sessionStartTimestamp; },
        isSessionActive: vi.fn((): boolean => state.active),
        getAllScenarioSessionBests: vi.fn((): SessionRankRecord[] => state.runs),
        getAllRankedSessionRuns: vi.fn((): RankedAttempt[] => state.rankedRuns),
        onSessionUpdated: vi.fn((listener: () => void): void => { state.sessionListener = listener; }),
    };
}

function _createRankedDependency(state: HarnessState): object {
    return {
        get sessionId(): number | null { return state.rankedState.rankedSessionId; },
        get state(): RankedSessionState { return state.rankedState; },
        onStateChanged: vi.fn((listener: () => void): void => { state.rankedListener = listener; }),
    };
}

function _createIdentityDependency(state: HarnessState): object {
    return {
        getDeviceId: state.getDeviceId,
        getKovaaksUsername: vi.fn((): string | null => state.profileUsername),
        isAnalyticsEnabled: vi.fn((): boolean => state.consent),
        onAnalyticsConsentChanged: vi.fn((listener: (enabled: boolean) => void): void => {
            state.consentListener = listener;
        }),
    };
}

function _createBenchmarkDependency(state: HarnessState): object {
    return {
        getAvailableDifficulties: vi.fn((): string[] => state.availableDifficulties),
        getScenarios: vi.fn(() => {
            const scenarioNames = new Set([
                ...state.runs.map((run: SessionRankRecord): string => run.scenarioName),
                ...state.rankedRuns.map((run: RankedAttempt): string => run.scenarioName),
            ]);

            return Array.from(scenarioNames, (name: string) => ({ name }));
        }),
    };
}

interface HarnessState {
    sessionId: string | null;
    sessionStartTimestamp: number | null;
    runs: SessionRankRecord[];
    rankedRuns: RankedAttempt[];
    rankedState: RankedSessionState;
    active: boolean;
    sessionListener: () => void;
    rankedListener: () => void;
    consentListener: (enabled: boolean) => void;
    consent: boolean;
    getDeviceId: ReturnType<typeof vi.fn>;
    availableDifficulties: string[];
    profileUsername: string | null;
}

function _run(scenarioName: string, bestScore: number = 1000): SessionRankRecord {
    return {
        scenarioName,
        bestScore,
        rankResult: {
            currentRank: "Test",
            nextRank: null,
            progressPercentage: 0,
            rankLevel: 1,
        },
    };
}

function _rankedState(): RankedSessionState {
    return {
        status: "IDLE",
        sequence: [],
        currentIndex: 0,
        difficulty: null,
        startTime: null,
        initialGauntletComplete: false,
        rankedSessionId: null,
        playedScenarios: [],
        initialEstimates: {},
        previousSessionRanks: {},
        scenarioStartTime: null,
        accumulatedScenarioSeconds: {},
    };
}

function _activeRankedState(scenarioName: string): RankedSessionState {
    return {
        status: "ACTIVE",
        sequence: [scenarioName],
        currentIndex: 0,
        difficulty: "Medium",
        startTime: new Date(FIRST_SESSION_START).toISOString(),
        initialGauntletComplete: false,
        rankedSessionId: FIRST_SESSION_START,
        playedScenarios: [scenarioName],
        initialEstimates: { [scenarioName]: 10 },
        previousSessionRanks: {},
        scenarioStartTime: new Date(FIRST_SESSION_START).toISOString(),
        accumulatedScenarioSeconds: {},
    };
}

function _payload(sessionId: string): SessionSyncPayload {
    return {
        deviceId: "anonymous-device",
        sessionId,
        sessionDate: "2026-07-29",
        isRanked: false,
        rankedSessionId: null,
        difficulty: null,
        triedAll: false,
        runs: [{ scenarioName: "Scenario A", bestScore: 1000 }],
    };
}

function _deferredSend(): DeferredSend {
    let resolvePromise: () => void = (): void => undefined;
    const promise = new Promise<void>((resolve: () => void): void => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
}

function _storedSessionIds(): string[] {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as SessionSyncPayload[])
        .map((payload: SessionSyncPayload): string => payload.sessionId);
}

function _sentPayloads(sendSync: ReturnType<typeof vi.fn>): SessionSyncPayload[] {
    return sendSync.mock.calls.map((call: unknown[]): SessionSyncPayload => call[0] as SessionSyncPayload);
}
