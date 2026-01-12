import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { AudioService } from "../../services/AudioService";
import { VisualSettingsService } from "../../services/VisualSettingsService";

describe("Dashboard & Sensory Symmetry", (): void => {
    beforeEach((): void => {
        _setupSymmetryStyle();
        _setupSymmetryDOM();
    });

    it("should maintain perfect symmetry around the scroll trench", (): void => {
        const panel: Element = document.querySelector(".dashboard-panel")!;
        const row: Element = document.querySelector(".benchmark-row")!;

        const panelRect: DOMRect = panel.getBoundingClientRect();
        const rowRect: DOMRect = row.getBoundingClientRect();

        const holeRight: number = panelRect.right - 36;
        const holeLeft: number = holeRight - 8;

        const gapLeft: number = holeLeft - rowRect.right;
        const gapRight: number = panelRect.right - holeRight;

        expect(gapLeft).toBeCloseTo(12, 0);
        expect(gapRight).toBeCloseTo(36, 0);
    });
});

describe("Audio Throttling Interaction", (): void => {
    let audioService: AudioService;
    let mockAudioInstance: { play: Mock; cloneNode: Mock; volume: number; preload: string };

    beforeEach((): void => {
        vi.useFakeTimers();
        mockInstance = {
            play: vi.fn().mockResolvedValue(undefined),
            cloneNode: vi.fn().mockReturnThis(),
            volume: 1, preload: "auto"
        };
        mockAudioInstance = mockInstance;

        const MockAudio: Mock = vi.fn().mockImplementation(function (this: unknown): unknown {
            return mockInstance;
        });
        vi.stubGlobal("Audio", MockAudio);

        audioService = _setupAudioService();
    });

    it("should throttle sounds played within 40ms", (): void => {
        audioService.playLight();
        audioService.playLight();
        audioService.playLight();
        expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(39);
        audioService.playLight();
        expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1);
        audioService.playLight();
        expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(2);
    });
});

let mockInstance: { play: Mock; cloneNode: Mock; volume: number; preload: string };

function _setupSymmetryStyle(): void {
    _setupStyleGlobal();
    _setupStyleTrench();
}

function _setupStyleGlobal(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root {
            --ui-scale: 1;
            --margin-spacing-multiplier: 1;
        }
        body { margin: 0; padding: 0; width: 64rem; height: 48rem; }
    `;
    document.head.appendChild(style);
}

function _setupStyleTrench(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        .dashboard-panel {
            position: relative; width: 62.5rem; height: 31.25rem; padding: 0;
            margin: 1.25rem; border: none; box-sizing: border-box;
            background: var(--background-1);
        }
        .benchmark-row {
            height: 2.5rem; margin-right: 3.5rem;
            background: var(--background-2);
        }
        .scroll-trench {
            position: absolute; top: 0; bottom: 0; right: 2.25rem;
            width: 0.5rem; background: rgba(var(--tactical-highlight-rgb), 0.1);
        }
    `;
    document.head.appendChild(style);
}

function _setupSymmetryDOM(): void {
    document.body.innerHTML = `
        <div class="dashboard-panel">
            <div class="benchmark-row"></div>
            <div class="scroll-trench"></div>
        </div>
    `;
}

function _setupAudioService(): AudioService {
    const mockVisualSettings = {
        subscribe: vi.fn((callback: (settings: { audioVolume: number }) => void): void =>
            callback({ audioVolume: 80 })),
    };

    return new AudioService(mockVisualSettings as unknown as VisualSettingsService);
}
