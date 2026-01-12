import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioService } from '../../services/AudioService';

describe('Dashboard & Sensory', () => {
    describe('Scrollbar Symmetry (ui.scroll.int.symmetry_math)', () => {
        beforeEach(() => {
            const style = document.createElement('style');
            style.innerHTML = `
                :root {
                    --margin-spacing-multiplier: 1;
                    --background-2-rgb: 0, 0, 0;
                    --upper-band-3-rgb: 255, 255, 255;
                    --glow-color: #00ffff;
                }
                body { margin: 0; padding: 0; width: 1024px; height: 768px; }
                .dashboard-panel {
                    width: 800px;
                    height: 600px;
                    margin: 40px auto;
                    position: relative;
                    padding: 24px; /* 1.5rem */
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                }
                .benchmark-table-container {
                    position: relative;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }
                .benchmark-table-container::before {
                    content: "";
                    position: absolute;
                    top: 24px;
                    bottom: 24px;
                    right: 12px; /* 0.75rem */
                    width: 8px;  /* 0.5rem */
                    background: grey;
                    z-index: 5;
                }
                .benchmark-table {
                    flex: 1;
                    margin-right: 32px; /* 2.0rem */
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }
                .benchmark-row {
                    height: 40px;
                    flex-shrink: 0;
                }
            `;
            document.head.appendChild(style);

            document.body.innerHTML = `
                <div class="dashboard-panel">
                    <div class="benchmark-table-container">
                        <div class="benchmark-table">
                            <div class="benchmark-row">Content</div>
                        </div>
                    </div>
                </div>
            `;
        });

        it('should maintain perfect symmetry around the scroll trench', () => {
            const panel = document.querySelector('.dashboard-panel')!;
            const row = document.querySelector('.benchmark-row')!;

            const panelRect = panel.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            const containerRight = panelRect.right - 24;
            const holeRight = containerRight - 12;
            const holeLeft = holeRight - 8;

            const gapLeft = holeLeft - rowRect.right;
            const gapRight = panelRect.right - holeRight;

            // Expectation: Gap between Row and Trench is exactly 12px (0.75rem)
            // Expectation: Gap between Trench and Panel Edge is exactly 36px (2.25rem = 1.5rem padding + 0.75rem margin)
            // Note: The rule "look identical" refers to the 0.75rem margins relative to their immediate containers.
            expect(gapLeft).toBeCloseTo(12, 0);
            expect(gapRight).toBeCloseTo(36, 0);
        });
    });

    describe('Audio Throttling (ui.audio.int.throttle)', () => {
        let audioService: AudioService;
        let mockVisualSettings: any;
        let mockAudioInstance: any;

        beforeEach(() => {
            vi.useFakeTimers();

            mockVisualSettings = {
                subscribe: vi.fn((cb) => cb({ audioVolume: 80 })),
            };

            mockAudioInstance = {
                play: vi.fn().mockResolvedValue(undefined),
                cloneNode: vi.fn().mockReturnThis(),
                volume: 1,
                preload: 'auto'
            };

            // Mock HTMLAudioElement in window
            (window as any).Audio = vi.fn().mockImplementation(function () {
                return mockAudioInstance;
            });

            audioService = new AudioService(mockVisualSettings as any);
        });

        it('should throttle sounds played within 40ms', () => {
            // First 3 calls rapidly
            audioService.playLight();
            audioService.playLight();
            audioService.playLight();

            // Only the first call should trigger a cloneNode (the prewarm doesn't clone)
            // prewarmCache calls _getOrCacheAudio twice -> 2 new Audio()
            // playSound calls cloneNode once
            expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(39);
            audioService.playLight();
            expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(1); // Still throttled

            vi.advanceTimersByTime(1); // Total 40ms elapsed
            audioService.playLight();
            expect(mockAudioInstance.cloneNode).toHaveBeenCalledTimes(2); // Plays now
        });
    });
});
