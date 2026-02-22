import { AudioService } from "../services/AudioService";
import { IdentityService } from "../services/IdentityService";

/**
 * Controller for handling the delete button interactions (hold-to-delete).
 */
export class DeleteInteractionController {
    private readonly _audioService: AudioService;
    private readonly _identityService: IdentityService;
    private readonly _btn: HTMLElement;
    private readonly _username: string;
    private readonly _fill: HTMLElement;

    private readonly _state = {
        progress: 0,
        interval: null as number | null,
        isHolding: false,
        tickCount: 0
    };

    /**
     * Creates an instance of DeleteInteractionController.
     * @param audioService - The audio service.
     * @param identityService - The identity service.
     * @param btn - The delete button element.
     * @param username - The username associated with the profile.
     */
    public constructor(
        audioService: AudioService,
        identityService: IdentityService,
        btn: HTMLElement,
        username: string
    ) {
        this._audioService = audioService;
        this._identityService = identityService;
        this._btn = btn;
        this._username = username;
        this._fill = btn.querySelector(".button-fill") as HTMLElement;

        this._setupListeners();
    }

    private _setupListeners(): void {
        this._btn.addEventListener("mousedown", (event): void => {
            event.stopPropagation();
            this._state.isHolding = true;
            this._btn.classList.add("holding");
            this._state.interval = window.setInterval(this._tick, 20);
            this._updateVisuals();
        });

        const stop = (event: Event): void => {
            event.stopPropagation();
            if (this._state.isHolding) this._reset();
        };

        this._btn.addEventListener("mouseup", stop);
        this._btn.addEventListener("mouseleave", stop);
        this._btn.addEventListener("click", (event): void => event.stopPropagation());
    }

    private readonly _updateVisuals = (): void => {
        // Fill up from 0 to 100%
        this._fill.style.height = `${this._state.progress}%`;

        if (this._state.isHolding) {
            this._fill.style.opacity = "1";
        } else {
            this._fill.style.opacity = this._state.progress > 0 ? "1" : "0";
        }
    };

    private readonly _reset = (): void => {
        if (this._state.interval) clearInterval(this._state.interval);
        this._state.interval = null;
        this._state.isHolding = false;
        this._state.progress = 0;
        this._state.tickCount = 0;
        this._updateVisuals();
        this._btn.classList.remove("holding");
    };

    private readonly _complete = (): void => {
        this._reset();
        this._audioService.playHeavy(0.4);
        this._identityService.removeProfile(this._username);
    };

    private readonly _tick = (): void => {
        this._state.progress += 2;
        this._state.tickCount++;

        if (this._state.tickCount % 2 === 0) {
            const isActive = this._btn.closest(".pfp-item")?.classList.contains("active");
            this._audioService.playLight(isActive ? 0.7 : 0.5);
        }

        if (this._state.progress >= 100) {
            this._state.progress = 100;
            this._complete();
        } else {
            this._updateVisuals();
        }
    };
}
