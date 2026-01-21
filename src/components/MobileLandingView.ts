/**
 * Component responsible for rendering the mobile landing page.
 * Shown when the user accesses the app from a confirmed mobile device.
 */
export class MobileLandingView {
  private readonly _mountPoint: HTMLElement;

  /**
   * Initializes the landing view with a mount point.
   *
   * @param mountPoint - The element where the landing page will be rendered.
   */
  public constructor(mountPoint: HTMLElement) {
    this._mountPoint = mountPoint;
  }

  private _container: HTMLElement | null = null;

  /**
   * Render the landing page into the mount point.
   */
  public render(): void {
    this._container = document.createElement("div");
    this._container.className = "mobile-landing-wrapper";
    this._container.innerHTML = this._generateHtml();

    this._mountPoint.appendChild(this._container);

    this._applyStyles();
    this._setupBypass();
  }


  private _generateHtml(): string {
    return `
      <div class="mobile-landing-container">
        <div class="mobile-landing-content">
          ${this._generateHeaderHtml()}
          ${this._generateMessageHtml()}
          ${this._generateActionsHtml()}
        </div>
        <div class="landing-footer">
          <a href="#" class="bypass-link" id="bypass-landing">Continue to app anyway (not recommended)</a>
        </div>
      </div>
    `;
  }



  private _generateHeaderHtml(): string {
    return `
      <h1 class="landing-title">Raw Output</h1>
    `;
  }


  private _generateMessageHtml(): string {
    return `
      <div class="landing-message-box">
        <div class="landing-icon">🖥️</div>
        <p class="landing-text">Raw Output is designed for <strong>Desktop</strong>.</p>
        <p class="landing-subtext">
          Kovaak's Aim Trainer requires a Personal Computer (Windows, Mac, Linux with Steam installed), and this companion app is built to run alongside it.
        </p>
      </div>
    `;
  }


  private _generateActionsHtml(): string {
    return `
      <div class="landing-actions">
        <p class="cta-text">Visit us on PC, or take a look at Raw Input instead!</p>
        <div class="social-links">
          <a href="https://discord.gg/rawinput" class="social-link" target="_blank">Discord</a>
          <a href="https://x.com/m_rawinput" class="social-link" target="_blank">Twitter</a>
        </div>
      </div>
    `;
  }


  private _applyStyles(): void {
    const styleId: string = "mobile-landing-styles";
    if (document.getElementById(styleId)) return;

    const styleElement: HTMLStyleElement = document.createElement("style");
    styleElement.setAttribute("id", styleId);
    styleElement.textContent = this._getStyles();
    document.head.appendChild(styleElement);

  }

  private _getStyles(): string {
    return `
      ${this._getContainerStyles()}
      ${this._getContentStyles()}
      ${this._getFooterStyles()}
      ${this._getTitleStyles()}
      ${this._getCardStyles()}
      ${this._getActionStyles()}
      ${this._getAnimationStyles()}
    `;

  }

  private _getContainerStyles(): string {
    return `
      .mobile-landing-container {
        position: fixed;
        inset: 0;
        background: radial-gradient(circle at top right, var(--background-2), var(--background-1));
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        z-index: 9999;
        font-family: 'Nunito', sans-serif;
        color: var(--text-default);
        text-align: center;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
    `;
  }

  private _getContentStyles(): string {
    return `
      .mobile-landing-content {
        max-width: 25rem;
        width: 100%;
        margin-top: auto;
        margin-bottom: 2rem;
        animation: fadeInScale 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }

    `;
  }

  private _getFooterStyles(): string {
    return `
      .landing-footer {
        margin-top: auto;
        padding-bottom: 2rem;
        font-size: 0.8rem;
        color: var(--lower-band-1);
        opacity: 0.6;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }


      .bypass-link {
        color: var(--lower-band-1);
        text-decoration: underline;
        cursor: pointer;
      }
      .bypass-link:hover {
        color: var(--upper-band-1);
      }
    `;
  }


  private _getTitleStyles(): string {
    return `
      .landing-title {
        font-size: 3rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, var(--upper-band-1), var(--upper-band-3));
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.04em;
      }
      .landing-subtitle {
        color: var(--lower-band-3);
        font-size: 1.1rem;
        margin-bottom: 3rem;
        font-weight: 600;
      }
    `;
  }

  private _getCardStyles(): string {
    return `
      .landing-message-box {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 1.5rem;
        padding: 2rem;
        backdrop-filter: blur(0.625rem);
        margin-bottom: 2rem;
        box-shadow: 0 0.625rem 1.875rem rgba(var(--tactical-shadow-rgb), 0.3);
      }

      .landing-icon { font-size: 3rem; margin-bottom: 1rem; }
      .landing-text { font-size: 1.25rem; color: var(--upper-band-2); margin-bottom: 1rem; }
      .landing-subtext { font-size: 0.9rem; color: var(--lower-band-1); line-height: 1.6; }
    `;
  }

  private _getActionStyles(): string {
    return `
      .landing-actions { margin-top: 2rem; }
      .cta-text { font-size: 0.95rem; color: var(--lower-band-2); margin-bottom: 1.5rem; }
      .social-links { display: flex; gap: 1rem; justify-content: center; }
      .social-link {
        padding: 0.6rem 1.5rem;
        background: rgba(var(--lower-band-1-rgb), 0.1);
        border: 1px solid var(--glass-border);
        border-radius: 0.75rem;
        color: var(--upper-band-1);
        text-decoration: none;
        font-weight: 700;
        transition: all 0.3s ease;
      }
      .social-link:hover {
        background: rgba(var(--lower-band-1-rgb), 0.2);
        transform: translateY(-2px);
        border-color: var(--upper-band-1);
      }
    `;
  }

  private _getAnimationStyles(): string {
    return `
      @keyframes fadeInScale {
        from { opacity: 0; transform: scale(0.95) translateY(0.625rem); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

    `;
  }

  private _setupBypass(): void {
    const bypassBtn = document.getElementById("bypass-landing");
    if (!bypassBtn) return;

    bypassBtn.addEventListener("click", (clickEvent: MouseEvent) => {
      clickEvent.preventDefault();

      this._container?.remove();

      const mainContainer = document.querySelector(".container") as HTMLElement;
      if (mainContainer) {
        mainContainer.style.display = "flex";
      }

      const app = document.getElementById("app");
      if (app) {
        app.style.display = "flex";
      }
    });
  }
}

