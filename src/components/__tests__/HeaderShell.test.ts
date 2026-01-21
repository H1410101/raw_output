import { describe, it, expect, beforeEach } from "vitest";

function _setupAll(): void {
    _setupShellStyleGlobal();
    _setupShellStyleComponents();
    _setupShellDOM();
}

describe("Header Title Viewport", (): void => {
    beforeEach(_setupAll);
    it("should keep title in the top-left 25% quadrant (header.title.ext.viewport)", (): void => {
        const title: Element = document.querySelector(".app-title-container")!;
        const rect: DOMRect = title.getBoundingClientRect();
        const viewportWidth: number = window.innerWidth;
        const viewportHeight: number = window.innerHeight;
        expect(rect.left).toBeLessThan(viewportWidth * 0.25);
        expect(rect.top).toBeLessThan(viewportHeight * 0.25);
    });
});

describe("Header Title Alignment", (): void => {
    beforeEach(_setupAll);
    it("should align title left edge with dashboard panel (header.title.ext.alignment)", (): void => {
        const titleText: Element = document.querySelector("h1")!;
        const panel: Element = document.querySelector(".dashboard-panel")!;
        const titleRect: DOMRect = titleText.getBoundingClientRect();
        const panelRect: DOMRect = panel.getBoundingClientRect();
        expect(titleRect.left).toBeCloseTo(panelRect.left, 1);
    });
});

describe("Header Navigation Symmetry", (): void => {
    beforeEach(_setupAll);
    it("should maintain mathematical symmetry of nav buttons (header.nav.ext.symmetry)", (): void => {
        const header: Element = document.querySelector(".app-header")!;
        const bBtn: Element = document.querySelector("#nav-benchmarks")!;
        const rBtn: Element = document.querySelector("#nav-ranked")!;
        const hRect: DOMRect = header.getBoundingClientRect();
        const bRect: DOMRect = bBtn.getBoundingClientRect();
        const rRect: DOMRect = rBtn.getBoundingClientRect();
        const hCenter: number = hRect.left + hRect.width / 2;
        expect(hCenter - bRect.left).toBeCloseTo(rRect.right - hCenter, 1);
    });
});

describe("Header Action Order", (): void => {
    beforeEach(_setupAll);
    it("should maintain correct action button order (header.ctrl.ext.order)", (): void => {
        const actionGroup: Element = document.querySelector(".header-actions")!;
        const buttons: NodeListOf<Element> = actionGroup.querySelectorAll(".header-action-btn");
        expect(buttons[0].id).toBe("header-folder-btn");
        expect(buttons[1].id).toBe("header-theme-btn");
        expect(buttons[2].id).toBe("header-settings-btn");
    });
});

function _setupShellStyleGlobal(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root {
            --ui-scale: 1; --margin-spacing-multiplier: 1;
            --label-font-multiplier: 1; --vertical-spacing-multiplier: 1;
        }
        body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; }
        .container { display: flex; flex-direction: column; height: 100%; width: 100%; margin: 0; }
    `;
    document.head.appendChild(style);
}

function _setupShellStyleComponents(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        .app-header {
            display: grid; grid-template-columns: 1fr auto 1fr;
            align-items: center; height: 3.75rem; padding: 0 1.25rem; box-sizing: border-box;
        }
        .app-title-container {
            width: 3.125rem; overflow: hidden; white-space: nowrap;
            margin-left: -0.3125rem; padding: 0 0.3125rem; box-sizing: border-box;
        }
        h1 { font-size: 0.625rem; margin: 0; }
        .nav-menu { display: flex; gap: 0.625rem; }
        .nav-item { padding: 0.3125rem; font-size: 0.625rem; width: 3.125rem; }
        .header-actions { display: flex; justify-self: end; gap: 0.3125rem; width: 3.125rem; }
        .header-action-btn { width: 0.9375rem; height: 0.9375rem; }
        .dashboard-panel { flex: 1; margin: 0 1.25rem 1.25rem; border: 1px solid var(--glass-border); }
    `;
    document.head.appendChild(style);
}

function _setupShellDOM(): void {
    document.body.innerHTML = `
        <div class="container">
            <header class="app-header">
                <div class="app-title-container" id="header-about-btn"><h1>Raw Output</h1></div>
                <nav class="nav-menu">
                    <button class="nav-item" id="nav-benchmarks">Benchmarks</button>
                    <button class="nav-item" id="nav-ranked">Ranked</button>
                </nav>
                <div class="header-actions">
                    <button class="header-action-btn" id="header-folder-btn"></button>
                    <button class="header-action-btn" id="header-theme-btn"></button>
                    <button class="header-action-btn" id="header-settings-btn"></button>
                </div>
            </header>
            <main id="app"><div class="dashboard-panel"></div></main>
        </div>
    `;
}
