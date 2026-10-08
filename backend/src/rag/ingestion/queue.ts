import { INGESTION_CONCURRENCY } from "../../config/env.js";
import { ingestDocument } from "./pipeline.js";

export const DEFAULT_CONCURRENCY_LIMIT = INGESTION_CONCURRENCY;

export interface IngestionQueueStatus {
  queuedCount: number;
  activeCount: number;
  concurrencyLimit: number;
}

/**
 * In-memory background ingestion queue with controlled concurrency.
 *
 * Ensures:
 * 1. Non-blocking upload requests (fire and forget into queue).
 * 2. Controlled concurrency (defaults to 3 concurrent documents).
 * 3. Individual error containment (failed jobs never stall the queue).
 * 4. Zero external infrastructure dependencies (adheres to Phase 1 blueprint).
 */
export class IngestionQueue {
  private queue: string[] = [];
  private activeCount: number = 0;
  private concurrencyLimit: number = DEFAULT_CONCURRENCY_LIMIT;
  private pendingOrRunning: Set<string> = new Set();
  private idleResolvers: Array<() => void> = [];

  constructor(concurrencyLimit: number = DEFAULT_CONCURRENCY_LIMIT) {
    this.concurrencyLimit = Math.max(1, concurrencyLimit);
  }

  public setConcurrency(limit: number): void {
    this.concurrencyLimit = Math.max(1, limit);
    this.processNext();
  }

  public enqueue(documentId: string): void {
    if (this.pendingOrRunning.has(documentId)) {
      return;
    }
    this.pendingOrRunning.add(documentId);
    this.queue.push(documentId);
    this.processNext();
  }

  public enqueueMany(documentIds: string[]): void {
    for (const id of documentIds) {
      this.enqueue(id);
    }
  }

  public getStatus(): IngestionQueueStatus {
    return {
      queuedCount: this.queue.length,
      activeCount: this.activeCount,
      concurrencyLimit: this.concurrencyLimit,
    };
  }

  public waitForIdle(): Promise<void> {
    if (this.queue.length === 0 && this.activeCount === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private processNext(): void {
    while (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const documentId = this.queue.shift();
      if (!documentId) break;

      this.activeCount++;
      void this.executeJob(documentId);
    }

    if (this.queue.length === 0 && this.activeCount === 0 && this.idleResolvers.length > 0) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }

  private async executeJob(documentId: string): Promise<void> {
    try {
      await ingestDocument(documentId);
    } catch (error) {
      console.error(`Background ingestion failed for document ${documentId}:`, error);
      // ingestDocument already updates document status to 'failed' in its catch block
    } finally {
      this.activeCount--;
      this.pendingOrRunning.delete(documentId);
      this.processNext();
    }
  }
}

export const ingestionQueue = new IngestionQueue();

export const enqueueDocument = (documentId: string): void => {
  ingestionQueue.enqueue(documentId);
};

export const enqueueDocuments = (documentIds: string[]): void => {
  ingestionQueue.enqueueMany(documentIds);
};

export const getIngestionQueueStatus = (): IngestionQueueStatus => {
  return ingestionQueue.getStatus();
};

export const waitForIngestionQueueIdle = (): Promise<void> => {
  return ingestionQueue.waitForIdle();
};
