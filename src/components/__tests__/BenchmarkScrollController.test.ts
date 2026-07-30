import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from "vitest";
import { BenchmarkScrollController } from "../benchmark/BenchmarkScrollController";
import { AppStateService } from "../../services/AppStateService";

interface ScrollElements {
  readonly scrollContainer: HTMLElement;
  readonly scrollThumb: HTMLElement;
  readonly hoverContainer: HTMLElement;
}

interface PersistingControllerFixture extends ScrollElements {
  readonly controller: BenchmarkScrollController;
  readonly setBenchmarkScrollTop: ReturnType<typeof vi.fn>;
}

interface FocusControllerFixture extends ScrollElements {
  readonly controller: BenchmarkScrollController;
  readonly setFocusedScenarioName: ReturnType<typeof vi.fn>;
}

interface ListenerRemovalSpies {
  readonly scroll: MockInstance;
  readonly hover: MockInstance;
  readonly window: MockInstance;
}

let pendingAnimationFrames: Map<number, FrameRequestCallback>;
let nextAnimationFrameId: number;

describe("BenchmarkScrollController", (): void => {
  beforeEach(setupAnimationFrameMocks);
  afterEach(resetScrollControllerTest);

  it(
    "initializes once and coalesces scroll synchronization per frame",
    verifyCoalescedSynchronization,
  );
  it(
    "removes every listener and pending frame exactly once",
    verifyDeterministicDestroy,
  );
});

function setupAnimationFrameMocks(): void {
  pendingAnimationFrames = new Map();
  nextAnimationFrameId = 1;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback): number => {
      const frameId: number = nextAnimationFrameId++;
      pendingAnimationFrames.set(frameId, callback);

      return frameId;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((frameId: number): void => {
      pendingAnimationFrames.delete(frameId);
    }),
  );
}

function resetScrollControllerTest(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
}

function verifyCoalescedSynchronization(): void {
  const fixture: PersistingControllerFixture = createPersistingController();
  initializeTwiceAndAssertListeners(fixture.controller, fixture);

  runNextAnimationFrame();
  expect(fixture.setBenchmarkScrollTop).not.toHaveBeenCalled();

  fixture.controller.refreshLayout();
  fixture.controller.refreshLayout();
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  runNextAnimationFrame();

  dispatchScrollPositions(fixture.scrollContainer, [20, 60, 120]);

  expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
  expect(fixture.setBenchmarkScrollTop).not.toHaveBeenCalled();
  runNextAnimationFrame();

  expect(fixture.setBenchmarkScrollTop).toHaveBeenCalledOnce();
  expect(fixture.setBenchmarkScrollTop).toHaveBeenCalledWith(120);
  expect(fixture.scrollThumb.style.display).toBe("block");
  expect(fixture.hoverContainer).toHaveClass("has-scroll");
  fixture.controller.destroy();
}

function initializeTwiceAndAssertListeners(
  controller: BenchmarkScrollController,
  elements: ScrollElements,
): void {
  const scrollListenerSpy = vi.spyOn(elements.scrollContainer, "addEventListener");
  const hoverListenerSpy = vi.spyOn(elements.hoverContainer, "addEventListener");
  const windowListenerSpy = vi.spyOn(window, "addEventListener");

  controller.initialize();
  controller.initialize();

  expect(scrollListenerSpy).toHaveBeenCalledTimes(2);
  expect(hoverListenerSpy).toHaveBeenCalledTimes(3);
  expect(windowListenerSpy).toHaveBeenCalledTimes(2);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
}

function createPersistingController(): PersistingControllerFixture {
  const elements: ScrollElements = createScrollElements();
  const setBenchmarkScrollTop = vi.fn();
  const controller: BenchmarkScrollController = new BenchmarkScrollController({
    ...elements,
    appStateService: {
      setBenchmarkScrollTop,
    } as unknown as AppStateService,
  });

  return { ...elements, controller, setBenchmarkScrollTop };
}

function dispatchScrollPositions(
  scrollContainer: HTMLElement,
  positions: number[],
): void {
  for (const position of positions) {
    scrollContainer.scrollTop = position;
    scrollContainer.dispatchEvent(new Event("scroll"));
  }
}

function verifyDeterministicDestroy(): void {
  const fixture: FocusControllerFixture = createFocusController();
  const removalSpies: ListenerRemovalSpies = createRemovalSpies(fixture);

  fixture.controller.initialize();
  fixture.hoverContainer.dispatchEvent(
    new MouseEvent("mousedown", { clientX: 10, clientY: 100 }),
  );
  expect(fixture.scrollThumb).toHaveClass("dragging");

  fixture.controller.destroy();
  fixture.controller.destroy();

  expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  expect(pendingAnimationFrames.size).toBe(0);
  assertListenerRemovals(removalSpies);
  expect(fixture.scrollThumb).not.toHaveClass("dragging");
  assertDestroyedControllerIgnoresEvents(fixture);
}

function createFocusController(): FocusControllerFixture {
  const elements: ScrollElements = createScrollElements();
  const setFocusedScenarioName = vi.fn();
  const controller: BenchmarkScrollController = new BenchmarkScrollController({
    ...elements,
    appStateService: {
      setFocusedScenarioName,
      setBenchmarkScrollTop: vi.fn(),
    } as unknown as AppStateService,
  });

  return { ...elements, controller, setFocusedScenarioName };
}

function createRemovalSpies(elements: ScrollElements): ListenerRemovalSpies {
  return {
    scroll: vi.spyOn(elements.scrollContainer, "removeEventListener"),
    hover: vi.spyOn(elements.hoverContainer, "removeEventListener"),
    window: vi.spyOn(window, "removeEventListener"),
  };
}

function assertListenerRemovals(spies: ListenerRemovalSpies): void {
  assertScrollListenerRemovals(spies.scroll);
  assertHoverListenerRemovals(spies.hover);
  assertWindowListenerRemovals(spies.window);
}

function assertScrollListenerRemovals(spy: MockInstance): void {
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith("scroll", expect.any(Function));
  expect(spy).toHaveBeenCalledWith("wheel", expect.any(Function));
}

function assertHoverListenerRemovals(spy: MockInstance): void {
  expect(spy).toHaveBeenCalledTimes(3);
  expect(spy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  expect(spy).toHaveBeenCalledWith("mousemove", expect.any(Function));
  expect(spy).toHaveBeenCalledWith("mouseleave", expect.any(Function));
}

function assertWindowListenerRemovals(spy: MockInstance): void {
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalledWith("mousemove", expect.any(Function));
  expect(spy).toHaveBeenCalledWith("mouseup", expect.any(Function));
}

function assertDestroyedControllerIgnoresEvents(
  fixture: FocusControllerFixture,
): void {
  const frameRequestCount: number = vi.mocked(requestAnimationFrame).mock.calls.length;
  fixture.setFocusedScenarioName.mockClear();
  fixture.scrollContainer.dispatchEvent(new Event("scroll"));
  fixture.scrollContainer.dispatchEvent(new WheelEvent("wheel"));
  fixture.hoverContainer.dispatchEvent(
    new MouseEvent("mousedown", { clientX: 10, clientY: 100 }),
  );

  expect(requestAnimationFrame).toHaveBeenCalledTimes(frameRequestCount);
  expect(fixture.setFocusedScenarioName).not.toHaveBeenCalled();
  expect(fixture.scrollThumb).not.toHaveClass("dragging");
}

function createScrollElements(): ScrollElements {
  const scrollContainer: HTMLElement = document.createElement("div");
  const scrollThumb: HTMLElement = document.createElement("div");
  const hoverContainer: HTMLElement = document.createElement("div");

  Object.defineProperties(scrollContainer, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
  Object.defineProperty(hoverContainer, "clientHeight", {
    configurable: true,
    value: 400,
  });
  scrollThumb.getBoundingClientRect = (): DOMRect =>
    ({
      x: 0,
      y: 0,
      width: 20,
      height: 40,
      top: 0,
      right: 20,
      bottom: 40,
      left: 0,
      toJSON: (): Record<string, never> => ({}),
    }) as DOMRect;

  hoverContainer.appendChild(scrollContainer);
  hoverContainer.appendChild(scrollThumb);
  document.body.appendChild(hoverContainer);

  return { scrollContainer, scrollThumb, hoverContainer };
}

function runNextAnimationFrame(): void {
  const nextFrame: IteratorResult<[number, FrameRequestCallback]> =
    pendingAnimationFrames.entries().next();

  if (nextFrame.done) {
    throw new Error("Expected a pending animation frame");
  }

  const [frameId, callback] = nextFrame.value;
  pendingAnimationFrames.delete(frameId);
  callback(0);
}
