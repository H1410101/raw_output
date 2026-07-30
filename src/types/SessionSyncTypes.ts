/**
 * Runtime limits shared by the sync client and endpoint.
 */
export const SESSION_SYNC_LIMITS = Object.freeze({
    requestBodyBytes: 64 * 1024,
    deviceIdLength: 128,
    sessionIdLength: 128,
    difficultyLength: 128,
    scenarioNameLength: 256,
    runs: 128,
    scoresPerRun: 3,
    absoluteNumber: 1_000_000_000_000,
    minimumDateYear: 2000,
    maximumDateYear: 2100,
});

/**
 * A benchmark or ranked run transmitted by score feedback.
 */
export interface SessionSyncRun {
    readonly scenarioName: string;
    readonly bestScore: number;
    readonly isRankedRun?: boolean;
    readonly targetRankUnits?: number;
    readonly endRankUnits?: number;
    readonly highscoreRankUnits?: number;
    readonly scores?: readonly number[];
}

/**
 * The complete score-feedback payload sent for a closed session.
 */
export interface SessionSyncPayload {
    readonly deviceId: string;
    readonly sessionId: string;
    readonly sessionDate: string;
    readonly isRanked: boolean;
    readonly rankedSessionId?: number | null;
    readonly difficulty?: string | null;
    readonly triedAll?: boolean;
    readonly runs: readonly SessionSyncRun[];
}

/**
 * Checks untrusted data against the complete sync payload contract.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a bounded sync payload.
 */
export function isSessionSyncPayload(value: unknown): value is SessionSyncPayload {
    if (!_hasBoundedSerializedSize(value) || !_isRecord(value) ||
        !Array.isArray(value.runs) || value.runs.length > SESSION_SYNC_LIMITS.runs) {
        return false;
    }

    const hasValidCommonFields: boolean = _isBoundedString(value.deviceId, SESSION_SYNC_LIMITS.deviceIdLength) &&
        _isBoundedString(value.sessionId, SESSION_SYNC_LIMITS.sessionIdLength) &&
        _isSessionDate(value.sessionDate) &&
        typeof value.isRanked === "boolean" &&
        _isOptionalBoolean(value.triedAll) &&
        value.runs.every((run: unknown): boolean => _isSessionSyncRun(run));

    if (!hasValidCommonFields) {
        return false;
    }

    if (value.isRanked) {
        return _isIdentifier(value.rankedSessionId) &&
            _isBoundedString(value.difficulty, SESSION_SYNC_LIMITS.difficultyLength) &&
            typeof value.triedAll === "boolean" &&
            value.runs.some((run: unknown): boolean => _isRecord(run) && run.isRankedRun === true);
    }

    return (value.rankedSessionId === undefined || value.rankedSessionId === null) &&
        (value.difficulty === undefined || value.difficulty === null) &&
        (value.triedAll === undefined || value.triedAll === false) &&
        value.runs.every((run: unknown): boolean => _isNonRankedRun(run));
}

function _isSessionSyncRun(value: unknown): value is SessionSyncRun {
    if (!_isRecord(value)) {
        return false;
    }

    const hasValidCommonFields: boolean = _isBoundedString(value.scenarioName, SESSION_SYNC_LIMITS.scenarioNameLength) &&
        _isBoundedNumber(value.bestScore) &&
        _isOptionalBoolean(value.isRankedRun);
    if (!hasValidCommonFields) {
        return false;
    }

    if (value.isRankedRun === true) {
        return _isBoundedNumber(value.targetRankUnits) &&
            _isBoundedNumber(value.endRankUnits) &&
            _isBoundedNumber(value.highscoreRankUnits) &&
            _isRankedScores(value.scores);
    }

    return value.targetRankUnits === undefined &&
        value.endRankUnits === undefined &&
        value.highscoreRankUnits === undefined &&
        value.scores === undefined;
}

function _isNonRankedRun(value: unknown): boolean {
    return _isRecord(value) && value.isRankedRun !== true;
}

function _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function _isBoundedString(value: unknown, maximumLength: number): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.length <= maximumLength;
}

function _isBoundedNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) &&
        Math.abs(value) <= SESSION_SYNC_LIMITS.absoluteNumber;
}

function _isIdentifier(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function _isOptionalBoolean(value: unknown): boolean {
    return value === undefined || typeof value === "boolean";
}

function _isRankedScores(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0 &&
        value.length <= SESSION_SYNC_LIMITS.scoresPerRun &&
        value.every((score: unknown): boolean => _isBoundedNumber(score));
}

function _hasBoundedSerializedSize(value: unknown): boolean {
    try {
        const serialized: string | undefined = JSON.stringify(value);

        return serialized !== undefined &&
            new TextEncoder().encode(serialized).byteLength <= SESSION_SYNC_LIMITS.requestBodyBytes;
    } catch {
        return false;
    }
}

function _isSessionDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    return year >= SESSION_SYNC_LIMITS.minimumDateYear &&
        year <= SESSION_SYNC_LIMITS.maximumDateYear &&
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day;
}
