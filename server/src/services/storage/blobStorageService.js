import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import crypto from 'crypto';

/**
 * Azure Blob Storage Service
 * Provides secure, private object storage for authorized scan files.
 * Uses Azure Managed Identity (DefaultAzureCredential) or connection string,
 * with an in-memory fallback for local offline development and testing.
 */

const DEFAULT_CONTAINER = 'leaklens-scans';

// In-memory buffer store for local development/testing when Azure credentials are not configured
const localBlobStore = new Map();

let blobServiceClient = null;
let isStorageConfigured = false;

/**
 * Initializes the BlobServiceClient using Managed Identity or Connection String.
 * @returns {BlobServiceClient|null}
 */
export function initBlobServiceClient() {
  if (blobServiceClient !== null) {
    return blobServiceClient;
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (connectionString) {
    try {
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      isStorageConfigured = true;
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Storage] BlobServiceClient initialized via Connection String.');
      }
      return blobServiceClient;
    } catch (err) {
      console.warn(`[Storage] Failed to initialize via Connection String: ${err.message}`);
    }
  }

  if (accountName) {
    try {
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      const credential = new DefaultAzureCredential();
      blobServiceClient = new BlobServiceClient(accountUrl, credential);
      isStorageConfigured = true;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Storage] BlobServiceClient initialized for account ${accountName} via Managed Identity.`);
      }
      return blobServiceClient;
    } catch (err) {
      console.warn(`[Storage] Failed to initialize via Managed Identity: ${err.message}`);
    }
  }

  isStorageConfigured = false;
  return null;
}

/**
 * Returns the target container name.
 */
export function getContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_CONTAINER;
}

/**
 * Generates an opaque, randomized, non-reversible storage path.
 * Strict Rule: Never use user-provided filenames as storage object paths.
 *
 * @param {string} scanId - UUID of the scan
 * @param {string} fileId - UUID of the file record
 * @returns {string} Safe blob path (e.g., 'scans/{scanId}/{fileId}.bin')
 */
export function generateSafeBlobPath(scanId, fileId) {
  const safeScanId = scanId || crypto.randomUUID();
  const safeFileId = fileId || crypto.randomUUID();
  return `scans/${safeScanId}/${safeFileId}.bin`;
}

/**
 * Uploads a file buffer to private Blob Storage.
 *
 * @param {object} params
 * @param {string} params.blobPath - Safe path generated via generateSafeBlobPath
 * @param {Buffer} params.buffer - File content buffer
 * @param {string} params.mimeType - Validated MIME type
 * @param {object} [params.metadata] - Safe non-sensitive metadata (e.g. content_hash, file_size)
 * @returns {Promise<{ blobPath: string, container: string, sizeBytes: number }>}
 */
export async function uploadFile({ blobPath, buffer, mimeType = 'application/octet-stream', metadata = {} }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error('Cannot upload empty buffer to Blob Storage');
    err.code = 'EMPTY_FILE_BUFFER';
    throw err;
  }

  const containerName = getContainerName();
  const client = initBlobServiceClient();

  if (isStorageConfigured && client) {
    const containerClient = client.getContainerClient(containerName);

    // Ensure container exists with private access (no public access)
    await containerClient.createIfNotExists({
      access: undefined // Private: anonymous public read access is explicitly disabled
    });

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    // Sanitize metadata: only ASCII alphanumeric, no raw secrets or tokens
    const sanitizedMetadata = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === 'string' || typeof v === 'number') {
        sanitizedMetadata[k.replace(/[^a-zA-Z0-9_]/g, '')] = String(v).slice(0, 256);
      }
    }

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobContentDisposition: 'attachment' // Force download rather than inline browser execution
      },
      metadata: sanitizedMetadata
    });

    return {
      blobPath,
      container: containerName,
      sizeBytes: buffer.length
    };
  }

  // Local fallback for offline development & tests
  localBlobStore.set(blobPath, {
    buffer: Buffer.from(buffer),
    mimeType,
    metadata,
    uploadedAt: new Date().toISOString()
  });

  return {
    blobPath,
    container: containerName,
    sizeBytes: buffer.length
  };
}

/**
 * Downloads a file buffer from Blob Storage.
 *
 * @param {string} blobPath - Stored blob path
 * @returns {Promise<Buffer>}
 */
export async function getFileBuffer(blobPath) {
  const containerName = getContainerName();
  const client = initBlobServiceClient();

  if (isStorageConfigured && client) {
    const containerClient = client.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    const exists = await blockBlobClient.exists();
    if (!exists) {
      const err = new Error(`Blob not found at path: ${blobPath}`);
      err.code = 'BLOB_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const downloadResponse = await blockBlobClient.downloadToBuffer();
    return downloadResponse;
  }

  // Local fallback
  const item = localBlobStore.get(blobPath);
  if (!item) {
    const err = new Error(`Blob not found in local store: ${blobPath}`);
    err.code = 'BLOB_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return Buffer.from(item.buffer);
}

/**
 * Deletes a file from Blob Storage.
 * Crucial for compensating cleanup during partial failure recovery.
 *
 * @param {string} blobPath
 * @returns {Promise<boolean>}
 */
export async function deleteBlob(blobPath) {
  if (!blobPath) return false;

  const containerName = getContainerName();
  const client = initBlobServiceClient();

  if (isStorageConfigured && client) {
    try {
      const containerClient = client.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      const res = await blockBlobClient.deleteIfExists();
      return res.succeeded;
    } catch (err) {
      console.warn(`[Storage] Failed to delete blob ${blobPath}: ${err.message}`);
      return false;
    }
  }

  // Local fallback
  return localBlobStore.delete(blobPath);
}

/**
 * Checks Blob Storage service health and connectivity.
 * @returns {Promise<{ isHealthy: boolean, configured: boolean, container: string, message: string }>}
 */
export async function checkStorageHealth() {
  const containerName = getContainerName();
  const client = initBlobServiceClient();

  if (isStorageConfigured && client) {
    try {
      const containerClient = client.getContainerClient(containerName);
      const exists = await containerClient.exists();
      return {
        isHealthy: true,
        configured: true,
        container: containerName,
        message: exists ? 'Storage container connected' : 'Storage service connected (container pending)'
      };
    } catch (err) {
      return {
        isHealthy: false,
        configured: true,
        container: containerName,
        message: 'Storage service connection failed'
      };
    }
  }

  return {
    isHealthy: true,
    configured: false,
    container: containerName,
    message: 'Storage operational in local development/fallback mode'
  };
}

/**
 * Resets local in-memory storage (used in test tear-down).
 */
export function resetLocalStorage() {
  localBlobStore.clear();
}

/**
 * Inspects local storage item count (used in testing).
 */
export function getLocalStorageCount() {
  return localBlobStore.size;
}

export default {
  initBlobServiceClient,
  getContainerName,
  generateSafeBlobPath,
  uploadFile,
  getFileBuffer,
  deleteBlob,
  checkStorageHealth,
  resetLocalStorage,
  getLocalStorageCount
};
