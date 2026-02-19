import { BenchmarkScrollController } from "../benchmark/BenchmarkScrollController";
import { AudioService } from "../../services/AudioService";

/**
 * Component that renders an information popup about the application.
 *
 * It uses the same styling and overlay logic as the visual settings menu,
 * including background dimming and a custom scrollbar for the text content.
 */
export class AboutPopupComponent {
    private readonly _closeCallbacks: (() => void)[] = [];
    private readonly _audioService: AudioService | null;

    /**
     * Initializes the about popup with an optional audio service for interactions.
     *
     * @param audioService - Service for playing interaction sounds.
     */
    public constructor(audioService: AudioService | null = null) {
        this._audioService = audioService;
    }

    /**
     * Subscribes a callback to be called when the popup is closed.
     *
     * @param callback - Function to call on closure.
     */
    public subscribeToClose(callback: () => void): void {
        this._closeCallbacks.push(callback);
    }

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
                this._closeCallbacks.forEach((callback): void => callback());
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
        card.appendChild(this._createIntroSection());
        card.appendChild(this._createViscoseSection());
        card.appendChild(this._createRawInputSection());
        card.appendChild(this._createRawOutputSection());
        card.appendChild(this._createAcknowledgementsSection());

        return card;
    }

    private _createScrollThumb(): HTMLElement {
        const thumb: HTMLDivElement = document.createElement("div");
        thumb.className = "custom-scroll-thumb";

        const gripContainer: HTMLDivElement = document.createElement("div");
        gripContainer.className = "grip-container";

        for (let i = 0; i < 3; i++) {
            const grip: HTMLDivElement = document.createElement("div");
            grip.className = `thumb-grip grip-${i}`;
            gripContainer.appendChild(grip);
        }
        thumb.appendChild(gripContainer);

        return thumb;
    }

    private _initializeScrollController(
        scrollArea: HTMLElement,
        thumb: HTMLElement,
        container: HTMLElement,
    ): void {
        const controller: BenchmarkScrollController = new BenchmarkScrollController({
            scrollContainer: scrollArea,
            scrollThumb: thumb,
            hoverContainer: container,
            appStateService: null,
            audioService: this._audioService,
        });

        controller.initialize();
    }

    private _createMainTitle(text: string): HTMLElement {
        const title: HTMLHeadingElement = document.createElement("h2");
        title.textContent = text;

        return title;
    }

    private _createIntroSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const introductionText: HTMLParagraphElement = document.createElement("p");
        introductionText.style.fontWeight = "600";
        introductionText.style.color = "var(--upper-band-3)";
        introductionText.textContent =
            "Raw Output is a third-party website for Viscose's Benchmarks, focused on pretty aesthetics and giving feedback for per-session performance, rather than being static unless you reach an all-time personal best.";

        section.appendChild(introductionText);

        return section;
    }

    private _createViscoseSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Viscose's Benchmarks";

        section.appendChild(title);
        this._addViscoseContent(section);

        return section;
    }

    private _addViscoseContent(container: HTMLElement): void {
        container.appendChild(this._createViscoseIntroQuote());
        container.appendChild(this._createViscosePracticeQuote());
        container.appendChild(this._createViscoseRankQuote());
    }

    private _createViscoseIntroQuote(): HTMLElement {
        const group: HTMLDivElement = document.createElement("div");
        group.className = "about-section";

        const introParagraph: HTMLParagraphElement = document.createElement("p");
        introParagraph.textContent = "Viscose is a high-level aimer, co-founder of Raw Input,";

        const quote: HTMLElement = this._createQuote(
            "hi!! ive been working on a set of benchmarks that are designed to focus specifically on things ive personally found the most useful category wise, scenarios that develop strong fundamental technique, and im rly happy with how they are turning out so far!",
            "RIN Discord / #Announcements",
            "https://discord.com/channels/1325617943450619904/1325622534002970686/1379826312126009426",
        );

        group.appendChild(introParagraph);
        group.appendChild(quote);

        return group;
    }

    private _createViscosePracticeQuote(): HTMLElement {
        const group: HTMLDivElement = document.createElement("div");
        group.className = "about-section";

        const practiceParagraph: HTMLParagraphElement = document.createElement("p");
        practiceParagraph.textContent =
            "Viscose's Benchmarks are organized collections of Kovaak's scenarios and score targets, with the intention to bring the score-chasing of benchmarks to a list of good scenarios for training.";

        const quote: HTMLElement = this._createQuote(
            "I picked out scenarios that I personally found the most helpful for ingame translation and technique improvement. While they are in benchmark form, this is more of a practice playlist disguised as a benchmark. That's why there are such a large number of scenarios and why some categories are underrepresented.",
            "Viscose Benchmarks Google Sheets",
            "https://docs.google.com/spreadsheets/d/1bFAlt6g_Gm8P9RBkcAoObpbIGFwVS5gXIdIK9B_YyZE/edit?pli=1&gid=671567857#gid=671567857",
        );

        group.appendChild(practiceParagraph);
        group.appendChild(quote);

        return group;
    }

    private _createViscoseRankQuote(): HTMLElement {
        const group: HTMLDivElement = document.createElement("div");
        group.className = "about-section";

        const wellRoundedParagraph: HTMLParagraphElement = document.createElement("p");
        wellRoundedParagraph.textContent = "Viscose also hopes to encourage more well-rounded players.";

        const quote: HTMLElement = this._createQuote(
            "In order to get a rank, you need to get at least one score in each subcategory. It's hard and it takes forever to get a rank, but I want to push people to be well rounded.",
            "Viscose Benchmarks Google Sheets",
            "https://docs.google.com/spreadsheets/d/1bFAlt6g_Gm8P9RBkcAoObpbIGFwVS5gXIdIK9B_YyZE/edit?pli=1&gid=671567857#gid=671567857",
        );

        group.appendChild(wellRoundedParagraph);
        group.appendChild(quote);

        return group;
    }

    private _createRawInputSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Raw Input";

        const description: HTMLParagraphElement = this._createRawInputDescription();
        const linkGroup: HTMLElement = this._createRawInputLinkGroup();

        section.appendChild(title);
        section.appendChild(description);
        section.appendChild(linkGroup);

        return section;
    }

    private _createRawInputDescription(): HTMLParagraphElement {
        const description: HTMLParagraphElement = document.createElement("p");
        description.textContent =
            "Raw Input is an aim group of high-level aimers, as well as a project to foster a sense of community within the aim training space. Go check out their discord!";

        return description;
    }

    private _createRawInputLinkGroup(): HTMLElement {
        const linkGroup: HTMLDivElement = document.createElement("div");
        linkGroup.className = "about-icon-group";

        linkGroup.appendChild(this._createLinkButton("Raw Input Website", "https://rawinput.net"));
        linkGroup.appendChild(this._createXIconButton());
        linkGroup.appendChild(this._createDiscordIconButton());

        return linkGroup;
    }

    private _createXIconButton(): HTMLElement {
        return this._createIconButton(
            "https://x.com/m_rawinput",
            `<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.486 3.24H4.298l13.309 17.41z"/></svg>`
        );
    }

    private _createDiscordIconButton(): HTMLElement {
        return this._createIconButton(
            "https://discord.gg/rawinput",
            `<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.125-.094.249-.192.37-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.419-2.157 2.419zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.175 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419z"/></svg>`
        );
    }

    private _createRawOutputSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Raw Output";

        section.appendChild(title);
        this._addRawOutputContent(section);

        return section;
    }

    private _addRawOutputContent(container: HTMLElement): void {
        container.appendChild(this._createPassionParagraph());
        container.appendChild(this._createChoiceParagraph());
        container.appendChild(this._createRawOutputList());
        container.appendChild(this._createLiveRankedParagraph());
        container.appendChild(this._createSupportParagraph());
        container.appendChild(this._createRawOutputLinkGroup());
    }

    private _createPassionParagraph(): HTMLParagraphElement {
        const passionParagraph: HTMLParagraphElement = document.createElement("p");
        passionParagraph.textContent =
            "Raw Output is my small passion project. I hope you like it!\nIt's fundamentally to encourage aim training even on days when we're feeling off and we can't quite hit our personal bests. I hope to encourage maintaining consistent and healthy habits.";

        return passionParagraph;
    }

    private _createChoiceParagraph(): HTMLParagraphElement {
        const choiceParagraph: HTMLParagraphElement = document.createElement("p");
        choiceParagraph.textContent = "The design choice to center around session best is twofold:";

        return choiceParagraph;
    }

    private _createRawOutputList(): HTMLElement {
        const list: HTMLUListElement = document.createElement("ul");
        list.style.margin = "0";
        list.style.paddingLeft = "1.5rem";
        list.style.color = "var(--text-dim)";
        list.style.fontSize = "calc(0.9rem * var(--scenario-font-multiplier))";

        list.appendChild(this._createListItem("it encourages putting in a minimum commitment even when your personal best feels far away"));
        list.appendChild(this._createListItem("it discourages overtraining to muscle failure and mental exhaustion"));

        return list;
    }

    private _createListItem(text: string): HTMLLIElement {
        const item: HTMLLIElement = document.createElement("li");
        item.textContent = text;

        return item;
    }

    private _createLiveRankedParagraph(): HTMLParagraphElement {
        const paragraph: HTMLParagraphElement = document.createElement("p");
        paragraph.innerHTML =
            "Ranked sessions also actively encourage diversification and well-roundedness, as well as providing targets to beat. This takes notes from the <a href='https://www.youtube.com/watch?v=4bO2R4p7RR4' target='_blank' style='color: inherit; text-decoration: underline;'>threshold method</a>, although it also supports <a href='https://www.youtube.com/watch?v=K2rPrkMD9es' target='_blank' style='color: inherit; text-decoration: underline;'>variants</a>.";

        return paragraph;
    }

    private _createSupportParagraph(): HTMLParagraphElement {
        const paragraph: HTMLParagraphElement = document.createElement("p");
        paragraph.textContent = "Support is optional and greatly appreciated!";
        paragraph.style.marginBottom = "0";

        return paragraph;
    }

    private _createRawOutputLinkGroup(): HTMLElement {
        const linkGroup: HTMLDivElement = document.createElement("div");
        linkGroup.className = "about-icon-group";

        linkGroup.appendChild(this._createIconButton("https://ko-fi.com/zhsn1410101#/", '<svg viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="0.5" d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493c1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87c-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182c2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546c-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195c-1.09-2-1.298-4.155-1.298-7.506c0-2.181.857-3.402 3.012-3.714c1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545c1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142c0 1.533.858 2.857 1.949 3.897c.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896c1.117-1.039 1.974-2.364 1.974-3.897c0-1.662-1.247-3.142-3.039-3.142c-1.065 0-1.792.545-2.338 1.298c-.493-.753-1.246-1.298-2.312-1.298"/></svg>'));
        linkGroup.appendChild(this._createIconButton("https://github.com/H1410101/raw_output", '<svg viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>'));

        return linkGroup;
    }

    private _createAcknowledgementsSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Acknowledgements";

        section.appendChild(title);
        this._addAcknowledgementsContent(section);

        return section;
    }

    private _addAcknowledgementsContent(container: HTMLElement): void {
        container.appendChild(this._createPinguefyAcknowledgement());
        container.appendChild(this._createFriendsAcknowledgement());
        container.appendChild(this._createPartnerAcknowledgement());
        container.appendChild(this._createAiAcknowledgement());
    }

    private _createPinguefyAcknowledgement(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");

        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>Pinguefy</strong> for responding on Discord within 2 minutes to tell me there was no established theme colour for Raw Input aimers. Thanks Pinguefy, your responsiveness is honestly crazy.<br>I may or may not have made myself sound unnecessarily suspicious for my own amusement.<br>Also thanks Pinguefy for letting me know that recent scores can be pulled from the official-unofficial Kovaaks web backend.";

        const linkGroup: HTMLDivElement = document.createElement("div");
        linkGroup.className = "about-icon-group";
        linkGroup.title = "Go follow them!";
        linkGroup.style.marginBottom = "1rem";

        linkGroup.appendChild(this._createIconButton("https://www.twitch.tv/pinguefy", '<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>'));
        linkGroup.appendChild(this._createIconButton("https://x.com/pinguefied", '<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.486 3.24H4.298l13.309 17.41z"/></svg>'));
        linkGroup.appendChild(this._createIconButton("https://www.youtube.com/@pinguefy", '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'));

        container.appendChild(acknowledgement);
        container.appendChild(linkGroup);

        return container;
    }

    private _createFriendsAcknowledgement(): HTMLParagraphElement {
        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>My friends</strong> for tolerating me gush about this project for like three weeks straight. Thanks frens :D";

        return acknowledgement;
    }

    private _createPartnerAcknowledgement(): HTMLParagraphElement {
        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>My partner</strong>, who helped me with a lot of the art assets, and for being an aesthetic consultant.";

        return acknowledgement;
    }

    private _createAiAcknowledgement(): HTMLParagraphElement {
        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>Gemini 3 Flash</strong> for compensating for the fact that this is my first web project. Thanks Google.<br>I would also be grateful if you didn't monopolize the LLM space though. Thanks in advance Google.";

        return acknowledgement;
    }

    private _createQuote(text: string, label: string, link: string): HTMLElement {
        const quote: HTMLElement = document.createElement("blockquote");
        quote.className = "about-quote";

        const quoteText: HTMLParagraphElement = document.createElement("p");
        quoteText.textContent = text;

        const button: HTMLAnchorElement = this._createLinkButton(label, link);
        button.style.marginTop = "0.75rem";

        quote.appendChild(quoteText);
        quote.appendChild(button);

        return quote;
    }

    private _createLinkButton(text: string, url: string): HTMLAnchorElement {
        const link: HTMLAnchorElement = document.createElement("a");
        link.className = "about-link-button";
        link.href = url;
        link.target = "_blank";
        link.textContent = text;

        return link;
    }

    private _createIconButton(url: string, iconHtml: string): HTMLAnchorElement {
        const link: HTMLAnchorElement = document.createElement("a");
        link.className = "about-icon-button";
        link.href = url;
        link.target = "_blank";
        link.innerHTML = iconHtml;

        return link;
    }
}
