import { expect, test } from "vitest";

/**
 * Technical Regression Test: Play Button Centering Symmetry.
 * Verifies that the primary play button is perfectly centered within the container,
 * regardless of the number of secondary buttons surrounding it.
 */
test("Ranked play button should be horizontally centered on the screen", async (): Promise<void> => {
    _setupStyle();
    _setupDOM();

    const container: Element = document.querySelector(".ranked-target")!;
    const playBtn: Element = document.querySelector("#ranked-play-now")!;

    const containerRect: DOMRect = container.getBoundingClientRect();
    const playBtnRect: DOMRect = playBtn.getBoundingClientRect();

    const containerCenter: number = containerRect.left + containerRect.width / 2;
    const playBtnCenter: number = playBtnRect.left + playBtnRect.width / 2;

    // We calculate the absolute distance from the centers. 
    // It should be essentially zero if perfectly centered.
    const centeringOffset: number = Math.abs(containerCenter - playBtnCenter);

    // Allowing a tiny sub-pixel tolerance for rendering calculations
    expect(centeringOffset).toBeLessThan(1);
});

function _setupStyle(): void {
    const style: HTMLStyleElement = document.createElement("style");
    const baseStyle: string = `
        :root { --label-font-multiplier: 1; --vertical-spacing-multiplier: 1; }
        .ranked-target { width: 1000px; display: flex; flex-direction: column; align-items: center; position: relative; }
        .media-controls {
            display: grid; --btn-size: 2.5rem;
            grid-template-columns: minmax(0, 1fr) var(--btn-size) var(--btn-size) auto var(--btn-size) var(--btn-size) minmax(0, 1fr);
            align-items: center; width: 100%; gap: calc(1rem * var(--label-font-multiplier));
        }`;
    const controlStyle: string = `
        .hud-group { letter-spacing: 0.1em; margin-right: -0.1em; }
        .hud-group.left { grid-column: 1; justify-self: end; }
        .hud-group.right { grid-column: 7; justify-self: start; }
        .media-btn { width: 2.5rem; height: 2.5rem; flex-shrink: 0; grid-row: 1; }
        .media-btn.primary { width: 3.75rem; height: 3.75rem; grid-column: 4; }
        #ranked-help-btn { grid-column: 2; } #ranked-back-btn { grid-column: 3; }
        #next-ranked-btn { grid-column: 5; } #end-ranked-btn { grid-column: 6; }`;
    style.innerHTML = baseStyle + controlStyle;
    document.head.appendChild(style);
}

function _setupDOM(): void {
    document.body.innerHTML = `
        <div class="ranked-target">
            <div class="media-controls">
                <div class="hud-group left" id="hud-left">
                    <div class="hud-label">SCENARIO</div>
                    <div class="hud-value">SHORT</div>
                </div>
                <button class="media-btn secondary" id="ranked-back-btn"></button>
                <button class="media-btn primary" id="ranked-play-now"></button>
                <button class="media-btn secondary" id="next-ranked-btn"></button>
                <button class="media-btn secondary destructive" id="end-ranked-btn"></button>
                <div class="hud-group right" id="hud-right">
                    <div class="hud-label">SESSION</div>
                    <div class="hud-value">VERY LONG HUD TEXT THAT MIGHT CAUSE SHIFTING</div>
                </div>
            </div>
        </div>
    `;
}
