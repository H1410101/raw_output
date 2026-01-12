import { describe, it, expect, beforeEach } from 'vitest';

describe('Header & Shell Layout', () => {
    beforeEach(() => {
        // 1. Setup minimal CSS for layout testing
        const style = document.createElement('style');
        style.innerHTML = `
            :root {
                --ui-scale: 1;
                --margin-spacing-multiplier: 1;
                --label-font-multiplier: 1;
                --vertical-spacing-multiplier: 1;
                --glass-border: rgba(255, 255, 255, 0.1);
            }
            body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; }
            .container { 
                display: flex; 
                flex-direction: column; 
                height: 100%; 
                width: 100%; 
                margin: 0; 
            }
            .app-header {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                height: 60px;
                padding: 0 20px;
                box-sizing: border-box;
            }
            .app-title-container { width: 50px; overflow: hidden; white-space: nowrap; margin-left: -5px; padding: 0 5px; box-sizing: border-box; }
            h1 { font-size: 10px; margin: 0; }
            .nav-menu { display: flex; gap: 10px; }
            .nav-item { padding: 5px; font-size: 10px; width: 50px; }
            .header-actions { display: flex; justify-self: end; gap: 5px; width: 50px; }
            .header-action-btn { width: 15px; height: 15px; }
            .dashboard-panel {
                flex: 1;
                margin: 0 20px 20px;
                border: 1px solid var(--glass-border);
            }
        `;
        document.head.appendChild(style);

        // 2. Setup HTML structure
        document.body.innerHTML = `
            <div class="container">
                <header class="app-header">
                    <div class="app-title-container" id="header-about-btn">
                        <h1>Raw Output</h1>
                    </div>
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
                <main id="app">
                    <div class="dashboard-panel"></div>
                </main>
            </div>
        `;
    });

    it('should keep title in the top-left 25% quadrant (header.title.ext.viewport)', () => {
        const title = document.querySelector('.app-title-container')!;
        const rect = title.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        expect(rect.left).toBeLessThan(viewportWidth * 0.25);
        expect(rect.top).toBeLessThan(viewportHeight * 0.25);
    });

    it('should align title left edge with dashboard panel (header.title.ext.alignment)', () => {
        const titleText = document.querySelector('h1')!;
        const panel = document.querySelector('.dashboard-panel')!;

        const titleRect = titleText.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();

        // Exact alignment check
        expect(titleRect.left).toBeCloseTo(panelRect.left, 1);
    });

    it('should maintain mathematical symmetry of nav buttons (header.nav.ext.symmetry)', () => {
        const header = document.querySelector('.app-header')!;
        const benchmarksBtn = document.querySelector('#nav-benchmarks')!;
        const rankedBtn = document.querySelector('#nav-ranked')!;

        const headerRect = header.getBoundingClientRect();
        const bRect = benchmarksBtn.getBoundingClientRect();
        const rRect = rankedBtn.getBoundingClientRect();

        const headerCenter = headerRect.left + headerRect.width / 2;

        const leftDist = headerCenter - bRect.left;
        const rightDist = rRect.right - headerCenter;

        // Equidistant check: left edge of left button and right edge of right button
        expect(leftDist).toBeCloseTo(rightDist, 1);
    });

    it('should implement 1fr-auto-1fr grid layout (header.nav.int.grid)', () => {
        const header = document.querySelector('.app-header')!;
        const style = window.getComputedStyle(header);

        expect(style.display).toBe('grid');
        // Match 3 columns
        expect(style.gridTemplateColumns).toMatch(/.*px .*px .*px/);

        // Detailed check: verify center slot is actually centered
        const nav = document.querySelector('.nav-menu')!;
        const headerRect = header.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();

        const headerCenter = headerRect.left + headerRect.width / 2;
        const navCenter = navRect.left + navRect.width / 2;

        expect(navCenter).toBeCloseTo(headerCenter, 1);
    });

    it('should maintain correct action button order (header.ctrl.ext.order)', () => {
        const actionGroup = document.querySelector('.header-actions')!;
        const buttons = actionGroup.querySelectorAll('.header-action-btn');

        expect(buttons[0].id).toBe('header-folder-btn');
        expect(buttons[1].id).toBe('header-theme-btn');
        expect(buttons[2].id).toBe('header-settings-btn');
    });
});
