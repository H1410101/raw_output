import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { SettingsUiFactory, SliderConfiguration } from "../ui/SettingsUiFactory";
import { AudioService } from "../../services/AudioService";

describe("SettingsUiFactory", () => {
    let audioMock: AudioService;

    beforeEach(() => {
        audioMock = {
            playLight: vi.fn(),
            playHeavy: vi.fn(),
        } as unknown as AudioService;
        SettingsUiFactory.setAudioService(audioMock);
        document.body.innerHTML = "";
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    describe("Slider Visual Context Resolution", () => {
        it("should correctly handle click on slider WITHOUT a notch (Session Interval)", () => {
            const onChange = vi.fn();
            const config = _createNoNotchConfig(onChange);

            _buildAndTestSliderInteraction(config, onChange);
        });

        it("should correctly handle click on slider WITH a notch (Master Volume)", () => {
            const onChange = vi.fn();
            const config = _createNotchConfig(onChange);

            _buildAndTestNotchSliderInteraction(config, onChange);
        });
    });
});

function _createNoNotchConfig(onChange: Mock): SliderConfiguration {
    return {
        label: "Interval",
        value: 30,
        min: 5,
        max: 60,
        options: undefined,
        showNotch: false,
        onChange,
    };
}

function _createNotchConfig(onChange: Mock): SliderConfiguration {
    return {
        label: "Master Volume",
        value: 50,
        min: 0,
        max: 100,
        showNotch: true,
        onChange,
    };
}

function _buildAndTestSliderInteraction(
    config: SliderConfiguration,
    onChange: Mock
): void {
    const slider = SettingsUiFactory.createSlider(config);
    document.body.appendChild(slider);

    const track = slider.querySelector(".dot-track") as HTMLElement;
    expect(track).toBeTruthy();

    const firstDotSocket = track.children[0] as HTMLElement;
    firstDotSocket.click();

    expect(onChange).toHaveBeenCalledWith(5);
    expect(track.dataset.selectedIndex).toBe("0");

    const firstDotTarget = firstDotSocket.querySelector(".dot-target") as HTMLElement;
    expect(firstDotTarget.classList.contains("pill")).toBe(true);
}

function _buildAndTestNotchSliderInteraction(
    config: SliderConfiguration,
    onChange: Mock
): void {
    const slider = SettingsUiFactory.createSlider(config);
    document.body.appendChild(slider);

    const track = slider.querySelector(".dot-track") as HTMLElement;
    const container = slider.querySelector(".dot-slider-container") as HTMLElement;

    const firstDotSocket = track.children[0] as HTMLElement;
    firstDotSocket.click();

    expect(onChange).toHaveBeenCalledWith(10);
    expect(container.dataset.selectedIndex).toBe("1");

    const firstDotTarget = firstDotSocket.querySelector(".dot-target") as HTMLElement;
    expect(firstDotTarget.classList.contains("pill")).toBe(true);
}
