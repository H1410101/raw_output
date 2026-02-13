import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from "vitest";
import { KovaaksApiService } from "../KovaaksApiService";
import { KovaaksBenchmarkResponse } from "../../types/KovaaksApiTypes";

const MOCK_STEAM_ID = "76561198000000000";
const MOCK_BENCHMARK_ID = "686";

let service: KovaaksApiService;
let fetchSpy: MockInstance;

/**
 * Helper to create a successful fetch response.
 * @param data - The data to respond with.
 */
const _mockFetchSuccess = (data: KovaaksBenchmarkResponse): void => {
    fetchSpy.mockResolvedValue({
        // eslint-disable-next-line id-length
        ok: true,
        json: () => Promise.resolve(data),
    } as Response);
};

/**
 * Helper to create a failing fetch response.
 */
const _mockFetchFailure = (): void => {
    fetchSpy.mockResolvedValue({
        // eslint-disable-next-line id-length
        ok: false,
        status: 404,
        statusText: "Not Found",
    } as Response);
};

beforeEach(() => {
    service = new KovaaksApiService();
    fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("KovaaksApiService Highscores", () => {
    it("should build correct URL and parameters", async () => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const mockResponse: KovaaksBenchmarkResponse = {
            benchmark_progress: 100,
            overall_rank: 5,
            categories: {},
            ranks: []
        };
        /* eslint-enable @typescript-eslint/naming-convention */

        _mockFetchSuccess(mockResponse);

        const result = await service.fetchBenchmarkHighscores(MOCK_STEAM_ID, MOCK_BENCHMARK_ID);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const urlArgs = fetchSpy.mock.calls[0][0] as string;

        expect(urlArgs).toContain("/benchmarks/player-progress-rank-benchmark");
        expect(urlArgs).toContain(`benchmarkId=${MOCK_BENCHMARK_ID}`);
        expect(urlArgs).toContain(`steamId=${MOCK_STEAM_ID}`);
        expect(urlArgs).toContain("page=0");
        expect(urlArgs).toContain("max=100");

        expect(result).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
        _mockFetchFailure();

        await expect(service.fetchBenchmarkHighscores(MOCK_STEAM_ID, MOCK_BENCHMARK_ID))
            .rejects.toThrow("Kovaaks API Error: Not Found");
    });
});
