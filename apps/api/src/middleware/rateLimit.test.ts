import { describe, it, expect, vi, afterEach } from 'vitest';
import { mcpRateLimit } from './rateLimit.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('mcpRateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const key = `limit-${Math.random()}`;
    expect(mcpRateLimit(key, 2, 60_000)).toBe(true);
    expect(mcpRateLimit(key, 2, 60_000)).toBe(true);
    expect(mcpRateLimit(key, 2, 60_000)).toBe(false);
  });

  it('resets after the window expires', () => {
    vi.useFakeTimers();
    const key = `reset-${Math.random()}`;
    expect(mcpRateLimit(key, 1, 60_000)).toBe(true);
    expect(mcpRateLimit(key, 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(mcpRateLimit(key, 1, 60_000)).toBe(true);
  });
});
