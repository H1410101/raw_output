import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BenchmarkView, BenchmarkViewServices } from '../BenchmarkView';
import { MockServiceFactory } from './MockServiceFactory';
import { AppStateService } from '../../services/AppStateService';
import { AudioService } from '../../services/AudioService';
import { VisualSettings } from '../../services/VisualSettingsService';

describe('Dashboard layout symmetry', (): void => {
    _setupAudioGlobalMock();
    _setupDocumentFontsMock();

    beforeEach((): void => {
        _setupDomEnvironment();
        vi.clearAllMocks();
    });

    it('should maintain perfect symmetry around the scroll trench', async (): Promise<void> => {
        const services: BenchmarkViewServices = _createConfiguredServices();
        const appState: AppStateService = MockServiceFactory.createAppStateMock();
        const benchmarkView: BenchmarkView = _initBenchmarkView(services, appState);

        await benchmarkView.render();
        await _waitForBehavioralElements();

        _assertLayoutSymmetry();
    });
});

describe('Dashboard audio interactions', (): void => {
    _setupAudioGlobalMock();
    _setupDocumentFontsMock();

    beforeEach((): void => {
        _setupDomEnvironment();
        vi.clearAllMocks();
    });

    it('should throttle audio service interaction during rapid UI selects', async (): Promise<void> => {
        const audioMocks = _setupCaptureMocks();
        const services: BenchmarkViewServices = _createConfiguredServices();
        const audioService = new AudioService(services.visualSettings);
        services.audio = audioService;

        const benchmarkView: BenchmarkView = _initBenchmarkView(services, MockServiceFactory.createAppStateMock());
        await benchmarkView.render();
        await _waitForBehavioralElements();

        _simulateRapidClicks();
        expect(audioMocks.cloneMock).toHaveBeenCalledTimes(1);
    });
});

function _initBenchmarkView(services: BenchmarkViewServices, appState: AppStateService): BenchmarkView {
    const mountPoint: HTMLElement = document.getElementById('mount')!;

    return new BenchmarkView(mountPoint, services, appState);
}

function _assertLayoutSymmetry(): void {
    const panel: HTMLElement = document.querySelector('.dashboard-panel')!;
    const row: HTMLElement = document.querySelector('.scenario-row')!;
    const thumb: HTMLElement = document.querySelector('.custom-scroll-thumb')!;

    const panelRect: DOMRect = panel.getBoundingClientRect();
    const rowRect: DOMRect = row.getBoundingClientRect();
    const thumbRect: DOMRect = thumb.getBoundingClientRect();

    expect(thumbRect.left - rowRect.right).toBeGreaterThanOrEqual(0);
    expect(panelRect.right - thumbRect.right).toBeGreaterThanOrEqual(0);
}

function _simulateRapidClicks(): void {
    const row: HTMLElement = document.querySelector('.scenario-row')!;
    for (let index = 0; index < 10; index++) {
        row.click();
    }
}

function _setupCaptureMocks(): { playMock: Mock; cloneMock: Mock } {
    const playMock: Mock = vi.fn().mockResolvedValue(undefined);
    const cloneMock: Mock = vi.fn().mockReturnThis();

    vi.stubGlobal('Audio', class {
        public play = playMock;
        public cloneNode = cloneMock;
        public volume: number = 1;
        public preload: string = 'auto';
        public addEventListener = vi.fn();
        public removeEventListener = vi.fn();
    });

    return { playMock, cloneMock };
}

function _setupDomEnvironment(): void {
    document.body.innerHTML = `
        <div id="test-root" style="width: 1280px; height: 800px; position: relative;">
            <div class="dashboard-panel" style="position: absolute; inset: 20px; display: flex; flex-direction: column;">
                <div id="mount" style="flex: 1; position: relative;"></div>
            </div>
        </div>
    `;
}

function _createConfiguredServices(): BenchmarkViewServices {
    const services: BenchmarkViewServices = MockServiceFactory.createViewDependencies({
        directory: { currentFolderName: 'test_folder' },
        history: { getLastCheckTimestamp: vi.fn().mockResolvedValue(1000) }
    });

    const settings: VisualSettings = {
        ...services.visualSettings.getSettings(),
        audioVolume: 80,
        marginSpacing: 'Normal',
        categorySpacing: 'Normal',
        dotCloudWidth: 'Normal'
    };

    vi.mocked(services.visualSettings.getSettings).mockReturnValue(settings);

    return services;
}

async function _waitForBehavioralElements(): Promise<void> {
    await vi.waitFor(() => {
        const rowFound: boolean = !!document.querySelector('.scenario-row');
        const thumbFound: boolean = !!document.querySelector('.custom-scroll-thumb');
        if (!rowFound || !thumbFound) throw new Error('Elements missing');
    }, { timeout: 2000 });
}

function _setupAudioGlobalMock(): void {
    vi.stubGlobal('Audio', class {
        public play = vi.fn().mockResolvedValue(undefined);
        public pause = vi.fn();
        public currentTime: number = 0;
        public addEventListener = vi.fn();
        public removeEventListener = vi.fn();
        public cloneNode = vi.fn().mockReturnThis();
        public volume: number = 1;
        public preload: string = 'auto';
    });
}

function _setupDocumentFontsMock(): void {
    Object.defineProperty(document, 'fonts', {
        value: { ready: Promise.resolve(), status: 'loaded' },
        configurable: true
    });
}
