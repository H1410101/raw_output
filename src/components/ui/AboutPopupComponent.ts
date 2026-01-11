import { BenchmarkScrollController } from "../benchmark/BenchmarkScrollController";

/**
 * Component that renders an information popup about the application.
 *
 * It uses the same styling and overlay logic as the visual settings menu,
 * including background dimming and a custom scrollbar for the text content.
 */
export class AboutPopupComponent {
    /**
     * Renders the about popup into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard();
        const thumb: HTMLElement = this._createScrollThumb();

        container.appendChild(card);
        container.appendChild(thumb);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this._initializeScrollController(card, thumb, container);
    }

    private _createOverlay(): HTMLElement {
        const overlay: HTMLDivElement = document.createElement("div");
        overlay.className = "settings-overlay";

        overlay.addEventListener("click", (event: MouseEvent): void => {
            if (event.target === overlay) {
                overlay.remove();
            }
        });

        return overlay;
    }

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container";

        return container;
    }

    private _createCard(): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card";

        card.appendChild(this._createMainTitle("About Raw Output"));
        card.appendChild(this._createRawOutputOneLiner());
        card.appendChild(this._createRawInputSection());
        card.appendChild(this._createViscoseSection());
        card.appendChild(this._createRawOutputLongIntro());
        card.appendChild(this._createAcknowledgementsSection());

        return card;
    }

    private _createScrollThumb(): HTMLElement {
        const thumb: HTMLDivElement = document.createElement("div");
        thumb.className = "custom-scroll-thumb";

        return thumb;
    }

    private _initializeScrollController(
        scrollArea: HTMLElement,
        thumb: HTMLElement,
        container: HTMLElement,
    ): void {
        const controller: BenchmarkScrollController = new BenchmarkScrollController(
            scrollArea,
            thumb,
            container,
        );

        controller.initialize();
    }

    private _createMainTitle(text: string): HTMLElement {
        const title: HTMLHeadingElement = document.createElement("h2");
        title.textContent = text;

        return title;
    }

    private _createRawOutputOneLiner(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.style.fontWeight = "600";
        introductionText.style.color = "var(--upper-band-3)";
        introductionText.textContent =
            "Raw Output is a modern, tactical dashboard for monitoring and analyzing Kovaak's performance metrics with deep integration and visual clarity.";

        section.appendChild(introductionText);

        return section;
    }

    private _createRawInputSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Raw Input";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.textContent =
            "Raw Input serves as the foundational data layer for the ecosystem. It provides low-level precision tracking and unified input handling, ensuring that every movement is captured with the highest fidelity across different platforms and engines.";

        section.appendChild(title);
        section.appendChild(introductionText);

        return section;
    }

    private _createViscoseSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Viscose Benchmarks";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.textContent =
            "The Viscose Benchmarks are a curated set of scenarios designed to challenge and measure specific aim mechanics. By categorizing performance into tiers, they provide a structured path for progression and a common language for the competitive aiming community.";

        section.appendChild(title);
        section.appendChild(introductionText);

        return section;
    }

    private _createRawOutputLongIntro(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Raw Output: Deep Dive";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.textContent =
            "Raw Output was born from the need for a more intuitive and visually engaging way to interact with training data. While raw CSV files provide the facts, Raw Output provides the story—transforming rows of numbers into dynamic visualizations like the Dot Cloud and the Rank Progress system. It bridges the gap between practice and analysis, allowing athletes to focus on what matters most: improving their craft. Developed with a focus on rich aesthetics and fluid interactions, Raw Output aims to be the definitive second brain for aim trainers, offering a glimpse into the future of performance tracking.";

        section.appendChild(title);
        section.appendChild(introductionText);

        return section;
    }

    private _createAcknowledgementsSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Acknowledgements";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.textContent =
            "Special thanks to the community contributors, beta testers, and the developers behind the open formats that make this tool possible. Built with passion for the aiming community.";

        section.appendChild(title);
        section.appendChild(introductionText);

        return section;
    }
}
