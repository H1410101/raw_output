import { VisualSettingsService } from "./VisualSettingsService";
import soundLight from "../assets/sounds/rxSound11.ogg";
import soundHeavy from "../assets/sounds/kick-deep.ogg";
import soundSuccessPerc from "../assets/sounds/808 perc.ogg";

interface WindowWithWebAudio extends Window {
    /* eslint-disable @typescript-eslint/naming-convention */
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    OfflineAudioContext?: typeof OfflineAudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
    /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Service for managing audio playback and volume control using Web Audio API.
 * This ensures zero-latency playback by pre-decoding sounds into memory.
 */
export class AudioService {
    private readonly _visualSettingsService: VisualSettingsService;

    private _masterVolume: number = 0.8;

    private _audioContext: AudioContext | null = null;
    private _masterGain: GainNode | null = null;
    private readonly _bufferCache: Map<string, AudioBuffer> = new Map();
    private readonly _pendingData: Map<string, Promise<ArrayBuffer>> = new Map();
    private readonly _lastPlayTimeMap: Map<string, number> = new Map();

    private static readonly _soundLight = soundLight;
    private static readonly _soundHeavy = soundHeavy;
    private static readonly _soundSuccessPerc = soundSuccessPerc;

    /**
     * Initializes the service and starts pre-fetching audio data.
     *
     * @param visualSettingsService - Service to subscribe to volume changes.
     */
    public constructor(visualSettingsService: VisualSettingsService) {
        this._visualSettingsService = visualSettingsService;
        this._visualSettingsService.subscribe((settings): void => {
            this._masterVolume = settings.audioVolume / 100;
            if (this._masterGain && this._audioContext) {
                this._masterGain.gain.setTargetAtTime(
                    this._masterVolume,
                    this._audioContext.currentTime,
                    0.05
                );
            }
        });

        this._startPreFetching();
    }

    private _startPreFetching(): void {
        this._fetchSound(AudioService._soundLight);
        this._fetchSound(AudioService._soundHeavy);
        this._fetchSound(AudioService._soundSuccessPerc);
    }

    private _fetchSound(path: string): void {
        const promise = fetch(path).then((response): Promise<ArrayBuffer> => response.arrayBuffer());
        this._pendingData.set(path, promise);
    }

    /**
     * Plays a sound effect with zero-latency (if already decoded).
     *
     * @param path - The path to the audio file.
     * @param volume - Relative volume (0.0 to 1.0).
     */
    public async playSound(path: string, volume: number = 1.0): Promise<void> {
        const requestTime = Date.now();
        const lastPlayTime = this._lastPlayTimeMap.get(path) ?? 0;
        if (requestTime - lastPlayTime < 40) return;
        this._lastPlayTimeMap.set(path, requestTime);

        try {
            const buffer = await this._getOrDecode(path);
            if (!buffer) return;

            // If it took too long to get/decode the buffer (e.g. initial load), 
            // and it's a transient sound, discard it.
            if (Date.now() - requestTime > 100) return;

            const context = await this._ensureContext();
            if (!context || !this._masterGain) return;

            // Final check: if the total delay since request is too high, discard.
            // This prevents "bursts" of hover sounds on first click.
            if (Date.now() - requestTime > 150) return;

            const source = context.createBufferSource();
            const envelope = context.createGain();

            source.buffer = buffer;

            const startTime = context.currentTime;
            envelope.gain.setValueAtTime(0, startTime);
            envelope.gain.linearRampToValueAtTime(volume, startTime + 0.002);

            const duration = buffer.duration;
            envelope.gain.setValueAtTime(volume, startTime + duration - 0.005);
            envelope.gain.linearRampToValueAtTime(0, startTime + duration);

            source.connect(envelope);
            envelope.connect(this._masterGain);
            source.start(startTime);
        } catch {
            // Silently fail if something goes wrong during decoding or playback
        }
    }

    private async _getOrDecode(path: string): Promise<AudioBuffer | null> {
        const cached = this._bufferCache.get(path);
        if (cached) return cached;

        const dataPromise = this._pendingData.get(path);
        if (!dataPromise) return null;

        const arrayBuffer = await dataPromise;

        // Use OfflineAudioContext for decoding - it doesn't require a user gesture!
        try {
            const win = window as unknown as WindowWithWebAudio;
            const OfflineContextClass = win.OfflineAudioContext || win.webkitOfflineAudioContext;
            if (OfflineContextClass) {
                const offlineContext = new OfflineContextClass(1, 1, 44100);

                const decoded = await offlineContext.decodeAudioData(arrayBuffer.slice(0));
                this._bufferCache.set(path, decoded);

                return decoded;
            }
        } catch {
            // Fallback to main context if offline decoding fails
        }

        const context = await this._ensureContext();
        if (!context) return null;

        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        this._bufferCache.set(path, decoded);

        return decoded;
    }

    /**
     * Plays the light hitsound (rxSound11.ogg).
     *
     * @param volume - Relative volume (0.0 to 1.0).
     */
    public playLight(volume: number = 1.0): void {
        this.playSound(AudioService._soundLight, volume);
    }

    /**
     * Plays the heavy defeat/impact sound (kick-deep.ogg).
     *
     * @param volume - Relative volume (0.0 to 1.0).
     */
    public playHeavy(volume: number = 1.0): void {
        this.playSound(AudioService._soundHeavy, volume);
    }

    /**
     * Plays the rhythmic success percussion (808 perc.ogg).
     *
     * @param volume - Relative volume (0.0 to 1.0).
     */
    public playSuccessPerc(volume: number = 1.0): void {
        this.playSound(AudioService._soundSuccessPerc, volume);
    }

    private async _ensureContext(): Promise<AudioContext | null> {
        if (!this._audioContext) {
            const win = window as unknown as WindowWithWebAudio;
            const AudioContextClass = win.AudioContext || win.webkitAudioContext;
            if (!AudioContextClass) return null;

            try {
                this._audioContext = new AudioContextClass({ sampleRate: 44100 });
            } catch {
                this._audioContext = new AudioContextClass();
            }

            if (!this._audioContext) return null;

            this._masterGain = this._audioContext.createGain();
            this._masterGain.gain.value = this._masterVolume;
            this._masterGain.connect(this._audioContext.destination);
        }

        if (this._audioContext.state === "suspended") {
            try {
                // We attempt to resume, but we don't await it indefinitely if it's blocked by the browser.
                // Usually resume() on a blocked context resolves its promise but the state remains suspended.
                await this._audioContext.resume();
            } catch {
                // Ignore resume errors
            }
        }

        // IMPORTANT: If still suspended, we return null to signal that playback is not possible yet.
        // This prevents "queueing" sounds that overlap on first gesture.
        if (this._audioContext.state !== "running") {
            return null;
        }

        return this._audioContext;
    }
}
