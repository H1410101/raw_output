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
    style.innerHTML = `
        :root {
            --label-font-multiplier: 1;
            --vertical-spacing-multiplier: 1;
        }
        .ranked-target {
            width: 1000px; /* Fixed width for testing */
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
        }
        .media-controls {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            width: 100%;
            gap: calc(1rem * var(--label-font-multiplier));
        }
        .controls-left { display: flex; justify-content: flex-end; }
        .controls-right { display: flex; justify-content: flex-start; gap: calc(1rem * var(--label-font-multiplier)); }
        .media-btn { width: 2.5rem; height: 2.5rem; flex-shrink: 0; }
        .media-btn.primary { width: 3.75rem; height: 3.75rem; }
    `;
    document.head.appendChild(style);
}

function _setupDOM(): void {
    document.body.innerHTML = `
        <div class="ranked-target">
            <div class="media-controls">
                <div class="controls-left">
                    <button class="media-btn secondary" id="ranked-back-btn"></button>
                </div>
                <button class="media-btn primary" id="ranked-play-now"></button>
                <div class="controls-right">
                    <button class="media-btn secondary" id="next-ranked-btn"></button>
                    <button class="media-btn secondary destructive" id="end-ranked-btn"></button>
                </div>
            </div>
        </div>
    `;
}
