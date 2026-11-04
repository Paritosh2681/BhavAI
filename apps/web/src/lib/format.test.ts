import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatDateTime,
  dateTime,
  percent,
  compactNumber,
  shortId,
  countryLabel,
  countryFlag,
  modeLabel,
  marketLabel,
} from './format.js';

describe('format utilities', () => {
  it('formats currency correctly', () => {
    expect(formatMoney(12, 'USD')).toBe('$12.00');
    expect(formatMoney(12.5, 'USD')).toBe('$12.50');
    expect(formatMoney(1500, 'INR')).toBe('₹1,500.00');
  });

  it('formats dates consistently', () => {
    expect(dateTime(null)).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(dateTime('invalid-date')).toBe('—');
    const iso = '2026-03-15T10:30:00Z';
    expect(dateTime(iso)).not.toBe('—');
  });

  it('formats percentages', () => {
    expect(percent(null)).toBe('—');
    expect(percent(undefined)).toBe('—');
    expect(percent(12.345)).toBe('12.3%');
    expect(percent(20, 0)).toBe('20%');
  });

  it('formats compact numbers', () => {
    expect(compactNumber(null)).toBe('—');
    expect(compactNumber(1500)).toBe('1.5K');
    expect(compactNumber(2500000)).toBe('2.5M');
  });

  it('shortens IDs cleanly', () => {
    expect(shortId(null)).toBe('—');
    expect(shortId('short')).toBe('short');
    expect(shortId('1234567890abcdef')).toBe('1234…cdef');
  });

  it('formats country labels and flags', () => {
    expect(countryLabel('IN')).toBe('India');
    expect(countryLabel('US')).toBe('US');
    expect(countryLabel(null)).toBe('—');
    expect(countryFlag('IN')).toBeTruthy();
    expect(countryFlag('US')).toBeTruthy();
    expect(countryFlag(null)).toBe('🌐');
  });

  it('formats agent modes and market labels', () => {
    expect(modeLabel('GEMINI')).toBe('Gemini language layer');
    expect(modeLabel('POLICY')).toBe('Policy engine');
    expect(marketLabel('DOMESTIC')).toBe('India domestic');
    expect(marketLabel('CROSS_BORDER')).toBe('Cross-border');
  });
});

