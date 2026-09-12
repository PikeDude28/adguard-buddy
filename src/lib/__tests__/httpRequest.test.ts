import { httpRequest, DEFAULT_TIMEOUT_MS, getDefaultTimeoutMs } from '../httpRequest';
import http from 'http';
import https from 'https';

// Mock the http and https modules
jest.mock('http');
jest.mock('https');

const mockHttp = http as jest.Mocked<typeof http>;
const mockHttps = https as jest.Mocked<typeof https>;

describe('httpRequest', () => {
  let mockRequest: jest.Mocked<http.ClientRequest>;
  let mockResponse: jest.Mocked<http.IncomingMessage>;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;

    // Setup mock response with proper event handling
    const responseOnMock = jest.fn().mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'data') {
        // Default behavior - will be overridden in specific tests
        setTimeout(() => callback('test response'), 0);
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return mockResponse;
    });

    mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      setEncoding: jest.fn(),
      on: responseOnMock,
    } as unknown as jest.Mocked<http.IncomingMessage>;

    // Setup mock request with proper event handling
    const requestOnMock = jest.fn().mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      // Default - no error
      return mockRequest;
    });

    mockRequest = {
      write: jest.fn(),
      end: jest.fn(),
      on: requestOnMock,
      setTimeout: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<http.ClientRequest>;

    // Mock the request method for both http and https
    mockHttp.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) callback(mockResponse);
      return mockRequest;
    });
    mockHttps.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) callback(mockResponse);
      return mockRequest;
    });
  });

  it('should make a GET request to HTTP URL', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'http://example.com/api/test',
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 80,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should make a GET request to HTTPS URL', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should make a POST request with body', async () => {
    const result = await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name": "test"}',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'POST',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: { 'Content-Type': 'application/json' },
    }, expect.any(Function));

    expect(mockRequest.write).toHaveBeenCalledWith('{"name": "test"}');
    expect(mockRequest.end).toHaveBeenCalled();

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should handle custom port', async () => {
    await httpRequest({
      method: 'GET',
      url: 'http://example.com:8080/api/test',
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 8080,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle query parameters', async () => {
    await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test?param1=value1&param2=value2',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test?param1=value1&param2=value2',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle allowInsecure for HTTPS', async () => {
    await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
      allowInsecure: true,
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
      rejectUnauthorized: false,
    }, expect.any(Function));
  });

  it('should not set rejectUnauthorized for HTTP with allowInsecure', async () => {
    await httpRequest({
      method: 'GET',
      url: 'http://example.com/api/test',
      allowInsecure: true,
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 80,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle PUT method', async () => {
    await httpRequest({
      method: 'PUT',
      url: 'https://example.com/api/test',
      body: 'updated data',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'PUT',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(mockRequest.write).toHaveBeenCalledWith('updated data');
  });

  it('should handle DELETE method', async () => {
    await httpRequest({
      method: 'DELETE',
      url: 'https://example.com/api/test',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'DELETE',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(mockRequest.write).not.toHaveBeenCalled();
  });

  it('should handle multiple data chunks', async () => {
    mockResponse.on.mockClear();
    mockResponse.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'data') {
        setTimeout(() => {
          callback('chunk1');
          callback('chunk2');
          callback('chunk3');
        }, 0);
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return mockResponse;
    });

    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(result.body).toBe('chunk1chunk2chunk3');
  });

  it('should handle request error', async () => {
    const networkError = new Error('Network connection failed');

    mockRequest.on.mockClear();
    mockRequest.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'error') {
        setTimeout(() => callback(networkError), 0);
      }
      return mockRequest;
    });

    mockResponse.on.mockClear();
    mockResponse.on.mockImplementation(() => mockResponse);

    await expect(httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    })).rejects.toThrow('Network connection failed');
  });

  it('should handle malformed URL', async () => {
    await expect(httpRequest({
      method: 'GET',
      url: 'not-a-valid-url',
    })).rejects.toThrow();
  });

  it('should handle null body', async () => {
    await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      body: null,
    });

    expect(mockRequest.write).not.toHaveBeenCalled();
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should handle empty body', async () => {
    await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      body: '',
    });

    expect(mockRequest.write).not.toHaveBeenCalled();
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should handle missing status code', async () => {
    mockResponse.statusCode = undefined;
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(result.statusCode).toBe(0);
  });

  it('should handle empty headers', async () => {
    await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
      headers: {},
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });
});

describe('default timeout configuration', () => {
  const original = process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;
    } else {
      process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = original;
    }
  });

  it('uses the built-in default when the environment variable is unset', () => {
    delete process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;
    expect(getDefaultTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('uses ADGUARD_BUDDY_REQUEST_TIMEOUT_MS when set to a positive number', () => {
    process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = '60000';
    expect(getDefaultTimeoutMs()).toBe(60_000);
  });

  it('allows zero to disable the global timeout', () => {
    process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = '0';
    expect(getDefaultTimeoutMs()).toBe(0);
  });

  it('falls back to the built-in default for invalid values', () => {
    process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = 'not-a-number';
    expect(getDefaultTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);

    process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = '-1';
    expect(getDefaultTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe('httpRequest timeouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;
  });

  it('arms a socket timeout with the default duration', async () => {
    const setTimeoutMock = jest.fn();
    const request = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      setTimeout: setTimeoutMock,
      destroy: jest.fn(),
    };
    const response = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'end') setTimeout(() => cb(), 0);
        return response;
      }),
    };

    (http.request as unknown as jest.Mock).mockImplementation((_options, callback) => {
      if (callback) callback(response);
      return request;
    });

    await httpRequest({ method: 'GET', url: 'http://example.com/x' });

    expect(setTimeoutMock).toHaveBeenCalledWith(DEFAULT_TIMEOUT_MS, expect.any(Function));
  });

  it('uses the configured environment timeout by default', async () => {
    process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS = '60000';
    const setTimeoutMock = jest.fn();
    const request = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      setTimeout: setTimeoutMock,
      destroy: jest.fn(),
    };
    const response = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'end') setTimeout(() => cb(), 0);
        return response;
      }),
    };

    (http.request as unknown as jest.Mock).mockImplementation((_options, callback) => {
      if (callback) callback(response);
      return request;
    });

    await httpRequest({ method: 'GET', url: 'http://example.com/x' });

    expect(setTimeoutMock).toHaveBeenCalledWith(60_000, expect.any(Function));
  });

  it('destroys the request when the timeout fires', async () => {
    const destroy = jest.fn();
    let fireTimeout: (() => void) | undefined;
    const request = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn().mockImplementation((event: string, cb: (error: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => {
            fireTimeout?.();
            cb(new Error('Request to example.com timed out after 50ms'));
          }, 0);
        }
        return request;
      }),
      setTimeout: jest.fn().mockImplementation((_ms: number, cb: () => void) => { fireTimeout = cb; }),
      destroy,
    };

    (http.request as unknown as jest.Mock).mockImplementation(() => request);

    await expect(
      httpRequest({ method: 'GET', url: 'http://example.com/x', timeoutMs: 50 }),
    ).rejects.toThrow(/timed out after 50ms/);
    expect(destroy).toHaveBeenCalled();
  });

  it('skips the timeout when it is disabled', async () => {
    const setTimeoutMock = jest.fn();
    const request = {
      write: jest.fn(), end: jest.fn(), on: jest.fn(), setTimeout: setTimeoutMock, destroy: jest.fn(),
    };
    const response = {
      statusCode: 204,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'end') setTimeout(() => cb(), 0);
        return response;
      }),
    };
    (http.request as unknown as jest.Mock).mockImplementation((_options, callback) => {
      if (callback) callback(response);
      return request;
    });

    await httpRequest({ method: 'GET', url: 'http://example.com/x', timeoutMs: 0 });

    expect(setTimeoutMock).not.toHaveBeenCalled();
  });
});
