import { VisualSettingsService } from "./VisualSettingsService";
import soundLight from "../assets/sounds/rxSound11.ogg";
import soundHeavy from "../assets/sounds/kick-deep.ogg";

/**
 * Service for managing audio playback and volume control.
 */
export class AudioService {
    private readonly _visualSettingsService: VisualSettingsService;

    private _masterVolume: number = 0.8;

    private readonly _audioCache: Map<string, HTMLAudioElement> = new Map();
    private readonly _lastPlayTimeMap: Map<string, number> = new Map();

    private static readonly _soundLight = soundLight;
    private static readonly _soundHeavy = soundHeavy;

    /**
     * Initializes the service with visual settings for volume control.
     *
     * @param visualSettingsService - Service to subscribe to volume changes.
     */
    public constructor(visualSettingsService: VisualSettingsService) {
        this._visualSettingsService = visualSettingsService;
        this._visualSettingsService.subscribe((settings): void => {
            this._masterVolume = settings.audioVolume / 100;
        });

        this._prewarmCache();
    }

    private _prewarmCache(): void {
        this._getOrCacheAudio(AudioService._soundLight);
        this._getOrCacheAudio(AudioService._soundHeavy);
    }

    /**
     * Plays a sound effect from the specified path.
     *
     * @param path - The URL or path to the audio file.
     * @param volume - The relative volume of this specific sound (0.0 to 1.0).
     */
    public playSound(path: string, volume: number = 1.0): void {
        const now: number = Date.now();
        const lastPlayTime: number = this._lastPlayTimeMap.get(path) ?? 0;

        if (now - lastPlayTime < 40) {
            return;
        }

        this._lastPlayTimeMap.set(path, now);

        const audio: HTMLAudioElement = this._getOrCacheAudio(path);

        const playInstance: HTMLAudioElement = audio.cloneNode(
            true,
        ) as HTMLAudioElement;
        playInstance.volume = volume * this._masterVolume;

        playInstance.play().catch((): void => {
            // Ignore errors from browser autoplay restrictions
        });
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

    private _getOrCacheAudio(path: string): HTMLAudioElement {
        if (this._audioCache.has(path)) {
            return this._audioCache.get(path)!;
        }

        const audio: HTMLAudioElement = new Audio(path);
        audio.preload = "auto";
        this._audioCache.set(path, audio);

        return audio;
    }
}
