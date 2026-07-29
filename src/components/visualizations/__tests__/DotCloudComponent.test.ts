/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { afterEach, describe, expect, test } from "vitest";
import { VisualSettings } from "../../../services/VisualSettingsService";
import { DotCloudComponent } from "../DotCloudComponent";

describe("DotCloudComponent", (): void => {
    afterEach((): void => {
        document.querySelectorAll(".dot-inspection-overlay, .dot-inspection-popup")
            .forEach((element: Element): void => element.classList.remove("visible"));
    });

    test("preserves finite dot ordering and metadata", (): void => {
        const component = new DotCloudComponent({
            entries: [
                { score: 150, timestamp: 2000 },
                { score: 100, timestamp: 1000 },
            ],
            thresholds: { Bronze: 100, Silver: 200 },
            settings: _createSettings(),
            isLatestInSession: true,
        });

        const container: HTMLElement = component.render();
        const dots: HTMLElement[] = Array.from(container.querySelectorAll(".dot-cloud-dot"));

        expect(dots.map((dot: HTMLElement): string | null => dot.getAttribute("data-score")))
            .toEqual(["100.00", "150.00"]);
        expect(dots[1].classList.contains("highlight")).toBe(true);
        expect(container.style.width).toBe("14rem");
        expect(container.style.height).toBe("2.2rem");

        component.destroy();
    });

    test("filters non-finite scores, thresholds, markers, and rank intervals", (): void => {
        const component = new DotCloudComponent({
            entries: [
                { score: Infinity, timestamp: 3000 },
                { score: 150, timestamp: 2000 },
                { score: 125, timestamp: Infinity },
            ],
            thresholds: { Invalid: Infinity },
            settings: _createSettings(),
            isLatestInSession: false,
            rankInterval: Number.NaN,
            targetRU: Infinity,
            achievedRU: -Infinity,
        });

        const container: HTMLElement = component.render();

        expect(container.querySelectorAll(".dot-cloud-dot")).toHaveLength(1);
        expect(container.querySelectorAll(".dot-cloud-marker")).toHaveLength(0);
        expect(container.innerHTML).not.toMatch(/(?:Infinity|NaN)/);

        component.destroy();
    });

    test("hides shared inspection UI before update and destroy", (): void => {
        const settings: VisualSettings = _createSettings();
        const component = new DotCloudComponent({
            entries: [{ score: 150, timestamp: 2000 }],
            thresholds: { Bronze: 100, Silver: 200 },
            settings,
            isLatestInSession: true,
        });
        const container: HTMLElement = component.render();
        document.body.appendChild(container);

        container.querySelector<HTMLElement>(".dot-cloud-dot")
            ?.dispatchEvent(new MouseEvent("mouseenter"));
        const overlay: HTMLElement | null = document.querySelector(".dot-inspection-overlay");
        expect(overlay).toHaveClass("visible");

        component.updateConfiguration(settings);
        expect(overlay).not.toHaveClass("visible");

        container.querySelector<HTMLElement>(".dot-cloud-dot")
            ?.dispatchEvent(new MouseEvent("mouseenter"));
        component.destroy();
        expect(overlay).not.toHaveClass("visible");
    });
});

function _createSettings(): VisualSettings {
    return {
        dotCloudWidth: "Normal",
        dotCloudSize: "Normal",
        visDotSize: "Normal",
        visRankFontSize: "Normal",
        scalingMode: "Aligned",
        showRankNotches: true,
        dotOpacity: 100,
        dotJitterIntensity: "Normal",
        highlightLatestRun: true,
    } as VisualSettings;
}
