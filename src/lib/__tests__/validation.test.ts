import {
  asObject, optionalBoolean, optionalEnum, optionalInt, optionalString,
  requireBoolean, requireEnum, requireString, validateTarget, ValidationError,
} from '../validation';

describe('validation', () => {
  describe('asObject', () => {
    it('accepts a plain object', () => {
      expect(asObject({ a: 1 })).toEqual({ a: 1 });
    });

    it.each([[null], [undefined], ['string'], [42], [[]]])('rejects %p', value => {
      expect(() => asObject(value)).toThrow(ValidationError);
    });
  });

  describe('requireString', () => {
    it('returns the value', () => {
      expect(requireString({ a: 'x' }, 'a')).toBe('x');
    });

    it('rejects a missing, empty or non-string value', () => {
      expect(() => requireString({}, 'a')).toThrow(ValidationError);
      expect(() => requireString({ a: '' }, 'a')).toThrow(ValidationError);
      expect(() => requireString({ a: 5 }, 'a')).toThrow(ValidationError);
    });

    it('enforces the length cap', () => {
      expect(() => requireString({ a: 'x'.repeat(11) }, 'a', 10)).toThrow(/exceeds 10/);
    });
  });

  describe('optionalString', () => {
    it('returns undefined for null and undefined', () => {
      expect(optionalString({}, 'a')).toBeUndefined();
      expect(optionalString({ a: null }, 'a')).toBeUndefined();
    });

    it('rejects a non-string', () => {
      expect(() => optionalString({ a: 1 }, 'a')).toThrow(ValidationError);
    });
  });

  describe('booleans', () => {
    it('requires a real boolean', () => {
      expect(requireBoolean({ a: false }, 'a')).toBe(false);
      expect(() => requireBoolean({ a: 'true' }, 'a')).toThrow(ValidationError);
      expect(() => requireBoolean({}, 'a')).toThrow(ValidationError);
    });

    it('allows an absent optional boolean', () => {
      expect(optionalBoolean({}, 'a')).toBeUndefined();
      expect(optionalBoolean({ a: true }, 'a')).toBe(true);
      expect(() => optionalBoolean({ a: 1 }, 'a')).toThrow(ValidationError);
    });
  });

  describe('optionalInt', () => {
    const range = { min: 1, max: 100 };

    it('accepts a numeric string within range', () => {
      expect(optionalInt({ a: '50' }, 'a', range)).toBe(50);
    });

    it('rejects values outside the range', () => {
      expect(() => optionalInt({ a: 0 }, 'a', range)).toThrow(/between 1 and 100/);
      expect(() => optionalInt({ a: 101 }, 'a', range)).toThrow(/between 1 and 100/);
    });

    it('rejects non-integers', () => {
      expect(() => optionalInt({ a: 1.5 }, 'a', range)).toThrow(/must be an integer/);
      expect(() => optionalInt({ a: 'abc' }, 'a', range)).toThrow(/must be an integer/);
    });
  });

  describe('enums', () => {
    const allowed = ['block', 'unblock'] as const;

    it('accepts an allowed value', () => {
      expect(requireEnum({ a: 'block' }, 'a', allowed)).toBe('block');
    });

    it('rejects anything else', () => {
      expect(() => requireEnum({ a: 'nuke' }, 'a', allowed)).toThrow(/must be one of/);
    });

    it('treats an absent optional enum as undefined', () => {
      expect(optionalEnum({}, 'a', allowed)).toBeUndefined();
    });
  });

  describe('validateTarget', () => {
    it.each([
      ['192.168.1.1'],
      ['192.168.1.1:8080'],
      ['adguard.local'],
      ['http://adguard.local'],
      ['https://adguard.local:3000/'],
    ])('accepts %s', target => {
      expect(() => validateTarget(target)).not.toThrow();
    });

    it.each([
      ['file:///etc/passwd'],
      ['ftp://host/x'],
      ['javascript:alert(1)'],
      ['host with spaces'],
      ['host;rm -rf /'],
      ['192.168.1.1:99999'],
      ['192.168.1.1:abc'],
    ])('rejects %s', target => {
      expect(() => validateTarget(target)).toThrow(ValidationError);
    });
  });
});
