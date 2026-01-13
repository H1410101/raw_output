import { expect, test } from "vitest";

/**
 * Technical Regression Test: Symmetry between Idle and Active Ranked states.
 * Verifies that the primary play button remains in the exact same pixel location.
 */
test("Ranked play button should be in the exact same location in Idle and Active states", async (): Promise<void> => {
    _setupStyle();

    // --- Phase 1: Idle State ---
    _setupIdleDOM();
    const idleBtn: Element = document.querySelector("#start-ranked-btn")!;
    const idleRect = idleBtn.getBoundingClientRect();
    const idlePos = { x: idleRect.left, y: idleRect.top };

    // --- Phase 2: Active State ---
    _setupActiveDOM();
    const activeBtn: Element = document.querySelector("#ranked-play-now")!;
    const activeRect = activeBtn.getBoundingClientRect();
    const activePos = { x: activeRect.left, y: activeRect.top };

    // --- Verification ---
    // Using toBeCloseTo or small delta for sub-pixel consistency
    expect(idlePos.x).toBeCloseTo(activePos.x, 1);
    expect(idlePos.y).toBeCloseTo(activePos.y, 1);
});

function _setupStyle(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root {
            --label-font-multiplier: 1;
            --vertical-spacing-multiplier: 1;
            --margin-spacing-multiplier: 1;
            --glass-border: rgba(255,255,255,0.1);
        }
        *, *::before, *::after { box-sizing: border-box; }
        .ranked-container {
            width: 800px;
            height: 600px;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .ranked-stats-bar {
            display: flex;
            gap: 2.5rem;
            padding: 1.25rem 1.75rem;
            margin-bottom: 2rem;
            flex-shrink: 0;
            height: 80px;
        }
        .ranked-main {
            flex: 1 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: fit-content;
            padding: 1rem 0;
        }
        .ranked-target {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }
        .media-controls {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 1rem;
            width: 100%;
        }
        .media-btn { width: 40px; height: 40px; }
        .media-btn.primary { width: 60px; height: 60px; }
    `;
    document.head.appendChild(style);
}

function _setupIdleDOM(): void {
    document.body.innerHTML = `
      <div class="ranked-container">
        <div class="ranked-stats-bar" style="visibility: hidden;">Stats</div>
        <div class="ranked-main">
            <div class="ranked-target">
                <span class="now-playing" style="visibility: hidden;">NOW PLAYING</span>
                <h2 class="ranked-scenario-name" style="visibility: hidden;">Placeholder</h2>
                <div class="media-controls">
                    <div class="controls-left" style="visibility: hidden;">
                        <button class="media-btn secondary"></button>
                    </div>
                    <button class="media-btn primary" id="start-ranked-btn"></button>
                    <div class="controls-right" style="visibility: hidden;">
                        <button class="media-btn secondary"></button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    `;
}

function _setupActiveDOM(): void {
    document.body.innerHTML = `
      <div class="ranked-container">
        <div class="ranked-stats-bar">Stats</div>
        <div class="ranked-main">
            <div class="ranked-target">
                <span class="now-playing">NOW PLAYING</span>
                <h2 class="ranked-scenario-name">Scenario Name</h2>
                <div class="media-controls">
                    <div class="controls-left">
                        <button class="media-btn secondary"></button>
                    </div>
                    <button class="media-btn primary" id="ranked-play-now"></button>
                    <div class="controls-right">
                        <button class="media-btn secondary"></button>
                        <button class="media-btn secondary destructive"></button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    `;
}
