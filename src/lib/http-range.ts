import type { Request, Response } from 'express';

import { buildSuccess } from '../shared/utils/response';

function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header || !header.startsWith('bytes=')) return null;
  const spec = header.slice(6).split(',')[0]?.trim();
  if (!spec) return null;

  const [rawStart, rawEnd] = spec.split('-');
  if (rawStart === undefined) return null;

  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export function sendJsonWithRange<T>(
  req: Request,
  res: Response,
  data: T,
  message: string,
  statusCode = 200,
): void {
  const payload = JSON.stringify(buildSuccess(data, message, req));
  const buffer = Buffer.from(payload, 'utf8');
  const size = buffer.length;
  const range = parseRange(req.headers.range, size);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-transform');

  if (!range) {
    res.setHeader('Content-Length', size);
    res.status(statusCode).end(buffer);
    return;
  }

  const chunk = buffer.subarray(range.start, range.end + 1);
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  res.setHeader('Content-Length', chunk.length);
  res.status(206).end(chunk);
}
