/**
 * High-Performance In-Memory TTL Cache Service
 * Provides fast key-value caching with automatic expiration, size-bounded LRU eviction,
 * and promise wrapping for expensive database and aggregation queries.
 */

class MemoryCache {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 1000;
    this.defaultTtlSec = options.defaultTtlSec || 60;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Retrieves a value by key. Returns null if expired or missing.
   * @param {string} key 
   * @returns {any | null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    // Refresh access order (LRU simulation)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Stores a value with a specific TTL in seconds.
   * @param {string} key 
   * @param {any} value 
   * @param {number} [ttlSec] 
   */
  set(key, value, ttlSec) {
    const ttl = (ttlSec !== undefined ? ttlSec : this.defaultTtlSec) * 1000;
    
    // Evict oldest entries if capacity reached
    if (this.store.size >= this.maxItems && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Deletes a specific cache key.
   * @param {string} key 
   */
  del(key) {
    return this.store.delete(key);
  }

  /**
   * Invalidates all keys matching a prefix or regex pattern.
   * @param {string | RegExp} pattern 
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.store.keys()) {
      const match = typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key);
      if (match) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Wraps an async query/function: returns cached value if valid, or executes fn and caches result.
   * @param {string} key 
   * @param {() => Promise<any>} fetchFn 
   * @param {number} [ttlSec] 
   * @returns {Promise<any>}
   */
  async wrap(key, fetchFn, ttlSec) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetchFn();
    this.set(key, fresh, ttlSec);
    return fresh;
  }

  /**
   * Clears the entire cache store.
   */
  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Returns cache metrics and hit ratio.
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxItems: this.maxItems,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(3)) : 0
    };
  }
}

// Global shared cache instance
export const cacheService = new MemoryCache({
  maxItems: 2000,
  defaultTtlSec: 30
});

export default cacheService;
