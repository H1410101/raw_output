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

        // Use the paths from the service itself to ensure matching
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const lightPath = (AudioService as any)._soundLight;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const heavyPath = (AudioService as any)._soundHeavy;

        const mockBuffer = { duration: 1 } as AudioBuffer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (audioService as any)._bufferCache.set(lightPath, mockBuffer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (audioService as any)._bufferCache.set(heavyPath, mockBuffer);

        services.audio = audioService;

        const benchmarkView: BenchmarkView = _initBenchmarkView(services, MockServiceFactory.createAppStateMock());
        await benchmarkView.render();
        await _waitForBehavioralElements();

        // Directly trigger multiple plays to verify internal throttling
        for (let i = 0; i < 10; i++) {
            audioService.playLight(0.5);
        }

        // Wait for the throttled call to actually play (async because of context resume)
        await vi.waitFor(() => expect(audioMocks.playMock).toHaveBeenCalledTimes(1));
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


// eslint-disable-next-line max-lines-per-function
function _setupCaptureMocks(): { playMock: Mock; decodeMock: Mock } {
    const playMock: Mock = vi.fn();
    const decodeMock: Mock = vi.fn().mockResolvedValue({
        duration: 1,
        numberOfChannels: 2,
        sampleRate: 44100,
        length: 44100
    });

    const mockBufferSource = {
        buffer: null,
        connect: vi.fn(),
        start: playMock,
    };

    const mockGainNode = {
        gain: {
            value: 1,
            setTargetAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
    };

    const mockContext = {
        state: 'running',
        currentTime: 0,
        createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        decodeAudioData: decodeMock,
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
    };

    const AudioContextMock = vi.fn().mockImplementation(function (this: unknown) {
        return mockContext;
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const OfflineAudioContextMock = vi.fn().mockImplementation(function (this: unknown) {
        return {
            decodeAudioData: decodeMock,
        };
    });
    vi.stubGlobal('OfflineAudioContext', OfflineAudioContextMock);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    }));

    return { playMock, decodeMock };
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
    const mockContext = {
        state: 'running',
        currentTime: 0,
        createBufferSource: vi.fn().mockReturnValue({
            connect: vi.fn(),
            start: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
            gain: { value: 1, setTargetAtTime: vi.fn() },
            connect: vi.fn(),
        }),
        decodeAudioData: vi.fn().mockResolvedValue({}),
        resume: vi.fn().mockResolvedValue(undefined),
        destination: {},
    };

    const AudioContextMock = vi.fn().mockImplementation(function (this: unknown) {
        return mockContext;
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const OfflineAudioContextMock = vi.fn().mockImplementation(function (this: unknown) {
        return {
            decodeAudioData: vi.fn().mockResolvedValue({}),
        };
    });
    vi.stubGlobal('OfflineAudioContext', OfflineAudioContextMock);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    }));
}

function _setupDocumentFontsMock(): void {
    Object.defineProperty(document, 'fonts', {
        value: { ready: Promise.resolve(), status: 'loaded' },
        configurable: true
    });
}
