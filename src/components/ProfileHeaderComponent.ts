import { IdentityService } from "../services/IdentityService";
import { NavigationController } from "./NavigationController";

/**
 * Responsibility: Manage the circular profile button in the application header.
 */
export class ProfileHeaderComponent {
    private readonly _button: HTMLButtonElement;
    private readonly _pfpImage: HTMLImageElement;
    private readonly _fallbackIcon: HTMLElement;
    private readonly _identityService: IdentityService;
    private readonly _navigationController: NavigationController;

    /**
     * Initializes the profile header component.
     * 
     * @param button - The profile button element.
     * @param identityService - Service for managing player profiles.
     * @param navigationController - Controller for handling view switches.
     */
    public constructor(
        button: HTMLButtonElement,
        identityService: IdentityService,
        navigationController: NavigationController
    ) {
        this._button = button;
        this._pfpImage = button.querySelector("#active-pfp") as HTMLImageElement;
        this._fallbackIcon = button.querySelector("#profile-fallback-icon") as HTMLElement;
        this._identityService = identityService;
        this._navigationController = navigationController;

        this._setupListeners();
        this.update();
    }

    /**
     * Updates the button state based on the active profile.
     */
    public update(): void {
        const activeProfile = this._identityService.getActiveProfile();

        if (activeProfile && activeProfile.pfpUrl) {
            this._pfpImage.src = activeProfile.pfpUrl;
            this._pfpImage.classList.remove("hidden");
            this._fallbackIcon.classList.add("hidden");
        } else {
            this._pfpImage.src = "";
            this._pfpImage.classList.add("hidden");
            this._fallbackIcon.classList.remove("hidden");
        }
    }

    private _setupListeners(): void {
        this._button.addEventListener("click", () => {
            this._navigationController.switchToAccountSelection();
        });

        this._identityService.onProfilesChanged(() => {
            this.update();
        });
    }
}
