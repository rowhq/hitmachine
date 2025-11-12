/**
 * RPC Retry Utility
 * Provides exponential backoff and retry logic for RPC calls to handle rate limits
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code;

  // Common rate limit indicators
  return (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429') ||
    errorCode === 429 ||
    errorCode === -32005 || // JSON-RPC rate limit error
    errorMessage.includes('limit exceeded')
  );
}

/**
 * Check if an error is retryable (network issues, timeouts, etc.)
 */
function isRetryableError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';

  return (
    isRateLimitError(error) ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('fetch failed')
  );
}

/**
 * Executes a function with exponential backoff retry logic
 * @param fn The async function to execute
 * @param options Retry configuration options
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if it's not a retryable error or we're out of retries
      if (!isRetryableError(error) || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      );

      // Add jitter (randomize delay by ±25%)
      const jitter = delay * (0.75 + Math.random() * 0.5);

      console.log(
        `[RPC Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed. ` +
        `Retrying in ${Math.round(jitter)}ms... Error: ${error.message}`
      );

      await sleep(jitter);
    }
  }

  throw lastError;
}

/**
 * Rate limiter class using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  /**
   * @param requestsPerSecond Maximum requests per second
   * @param burstSize Maximum burst size (defaults to requestsPerSecond)
   */
  constructor(requestsPerSecond: number, burstSize?: number) {
    this.maxTokens = burstSize || requestsPerSecond;
    this.tokens = this.maxTokens;
    this.refillRate = requestsPerSecond;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000; // in seconds
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Wait until a token is available, then consume it
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Calculate how long to wait for next token
      const tokensNeeded = 1 - this.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000; // in ms

      await sleep(Math.max(100, waitTime)); // Wait at least 100ms
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }
}

/**
 * Create a rate-limited version of an async function
 * @param fn The function to rate limit
 * @param requestsPerSecond Maximum requests per second
 * @param burstSize Maximum burst size
 */
export function createRateLimitedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  requestsPerSecond: number,
  burstSize?: number
): T {
  const limiter = new RateLimiter(requestsPerSecond, burstSize);

  return (async (...args: Parameters<T>) => {
    return limiter.execute(() => fn(...args));
  }) as T;
}
