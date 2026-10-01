import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

// jsdom doesn't implement scrollIntoView; cmdk calls it when keyboard
// navigation moves the highlighted palette item.
Element.prototype.scrollIntoView ??= () => {};
