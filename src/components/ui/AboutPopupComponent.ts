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
        introParagraph.textContent = "Viscose is a high-level aimer, co-founder of Raw Input aimers,";

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
        container.appendChild(this._createFutureParagraph());
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

        list.appendChild(this._createListItem("it encourages pushing oneself harder even when your personal best feels far away"));
        list.appendChild(this._createListItem("it discourages overtraining to muscle failure and mental exhaustion"));

        return list;
    }

    private _createListItem(text: string): HTMLLIElement {
        const item: HTMLLIElement = document.createElement("li");
        item.textContent = text;

        return item;
    }

    private _createFutureParagraph(): HTMLParagraphElement {
        const futureParagraph: HTMLParagraphElement = document.createElement("p");
        futureParagraph.textContent =
            "I wanted to also create a sort of Ranked Mode, with you against the benchmark. I think I will still do it at some point, but that point looks like it might be 6 months or a year from now.";

        return futureParagraph;
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
        container.appendChild(this._createAiAcknowledgement());
    }

    private _createPinguefyAcknowledgement(): HTMLParagraphElement {
        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>Pinguefy</strong> for responding on Discord within 2 minutes to tell me there was no established theme colour for Raw Input aimers. Thanks Pinguefy, your responsiveness is honestly crazy.<br>I may or may not have made myself sound unnecessarily suspicious for my own amusement.";

        return acknowledgement;
    }

    private _createFriendsAcknowledgement(): HTMLParagraphElement {
        const acknowledgement: HTMLParagraphElement = document.createElement("p");
        acknowledgement.innerHTML =
            "<strong>My friends</strong> for tolerating me gush about this project for like a week straight. Thanks frens :D";

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
