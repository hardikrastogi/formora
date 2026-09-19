import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; Radix's checkbox uses one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;
