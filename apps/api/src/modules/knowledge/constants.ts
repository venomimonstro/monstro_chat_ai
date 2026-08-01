export const QUEUE_CRAWL_SITE = 'crawl-site';
export const QUEUE_INGEST_DOCUMENT = 'ingest-document';

export const CRAWL_MAX_DEPTH = 3;
export const CRAWL_JOB_TIMEOUT_MS = 20 * 60 * 1000;
export const CRAWL_JOB_ATTEMPTS = 3;

export const CHUNK_TOKEN_SIZE = 600;
export const CHUNK_TOKEN_OVERLAP = 100;
export const EMBEDDING_DIMENSIONS = 1536;

export const DEFAULT_CRAWL_PAGE_LIMIT = 50;

export const ALLOWED_UPLOAD_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
] as const;

export const MAX_UPLOAD_BYTES_FALLBACK = 10 * 1024 * 1024;
