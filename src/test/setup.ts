import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import '../styles/palette.css';
import '../styles/typography.css';
import '../styles/hud.css';
import '../styles/components.css';
import '../styles/layout.css';

interface MockFontFaceSet {
  readonly status: 'loaded';
  readonly ready: Promise<MockFontFaceSet>;
  addEventListener: () => void;
  removeEventListener: () => void;
}

class MockIntersectionObserver implements IntersectionObserver {
  public readonly root: Element | Document | null = null;
  public readonly rootMargin: string = '0px';
  public readonly thresholds: number[] = [0];

  public disconnect(): void {}
  public observe(targetElement: Element): void { void targetElement; }
  public takeRecords(): IntersectionObserverEntry[] { return []; }
  public unobserve(targetElement: Element): void { void targetElement; }
}

class MockResizeObserver implements ResizeObserver {
  public disconnect(): void {}
  public observe(targetElement: Element): void { void targetElement; }
  public unobserve(targetElement: Element): void { void targetElement; }
}

class MockCanvasRenderingContext2D {
  public font: string = '';
  public textBaseline: CanvasTextBaseline = 'alphabetic';
  private _lastTextWidth = 0;

  public measureText(text: string): TextMetrics {
    const fontSizeMatch = this.font.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 16;
    this._lastTextWidth = Math.max(1, Math.ceil(text.length * fontSize * 0.6));

    return { width: this._lastTextWidth } as TextMetrics;
  }

  public fillText(text: string, xPosition: number, yPosition: number): void {
    void xPosition;
    void yPosition;
    this.measureText(text);
  }

  public getImageData(startX: number, startY: number, sourceWidth: number, sourceHeight: number): ImageData {
    void startX;
    void startY;
    const data = new Uint8ClampedArray(sourceWidth * sourceHeight * 4);
    const paintedWidth = Math.min(this._lastTextWidth, sourceWidth);

    for (let x = 0; x < paintedWidth; x++) {
      const alphaIndex = x * 4 + 3;
      data[alphaIndex] = 255;
    }

    return { data, width: sourceWidth, height: sourceHeight, colorSpace: 'srgb' } as ImageData;
  }
}

const mockFonts: MockFontFaceSet = {
  status: 'loaded',
  ready: Promise.resolve(undefined as unknown as MockFontFaceSet),
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
};

Object.defineProperty(mockFonts, 'ready', {
  configurable: true,
  value: Promise.resolve(mockFonts),
});

Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: mockFonts,
});

document.documentElement.style.setProperty('--scenario-name-weight', '500');
document.documentElement.style.setProperty('--scenario-name-family', 'Nunito');
document.documentElement.style.setProperty('--margin-spacing-multiplier', '1');

globalThis.IntersectionObserver = MockIntersectionObserver;
globalThis.ResizeObserver = MockResizeObserver;

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: function getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId !== '2d') {
      return null;
    }

    return new MockCanvasRenderingContext2D();
  },
});
