import { axisTicks, bucketTimestamps, compactNumber, formatBucketLabel, niceMax } from '../scale';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [1, 1],
    [7, 10],
    [12, 20],
    [45, 50],
    [1234, 2000],
    [98765, 100000],
  ])('rounds %p up to %p', (input, expected) => {
    expect(niceMax(input)).toBe(expected);
  });

  it('handles non-finite input', () => {
    expect(niceMax(NaN)).toBe(1);
    expect(niceMax(Infinity)).toBe(1);
  });
});

describe('axisTicks', () => {
  it('spans zero to a rounded maximum', () => {
    expect(axisTicks(45, 4)).toEqual([0, 12.5, 25, 37.5, 50]);
  });

  it('honours the requested tick count', () => {
    expect(axisTicks(100, 2)).toHaveLength(3);
  });
});

describe('compactNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1200, '1.2k'],
    [12345, '12k'],
    [1200000, '1.2M'],
    [15000000, '15M'],
  ])('formats %p as %p', (input, expected) => {
    expect(compactNumber(input)).toBe(expected);
  });
});

describe('bucketTimestamps', () => {
  const now = new Date('2026-03-15T12:00:00Z').getTime();

  it('places the newest bucket last', () => {
    const stamps = bucketTimestamps(3, 'hours', now);
    expect(stamps[2].getTime()).toBe(now);
    expect(stamps[0].getTime()).toBe(now - 2 * 3600000);
  });

  it('steps by a day for daily data', () => {
    const stamps = bucketTimestamps(2, 'days', now);
    expect(stamps[0].getTime()).toBe(now - 86400000);
  });

  it('returns nothing for an empty series', () => {
    expect(bucketTimestamps(0, 'hours', now)).toEqual([]);
  });
});

describe('formatBucketLabel', () => {
  it('renders an hour label for hourly buckets', () => {
    expect(formatBucketLabel(new Date('2026-03-15T12:00:00Z'), 'hours')).toMatch(/\d/);
  });

  it('renders a date label for daily buckets', () => {
    expect(formatBucketLabel(new Date('2026-03-15T12:00:00Z'), 'days')).toMatch(/\w/);
  });
});
