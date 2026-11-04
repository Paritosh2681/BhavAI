import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}`, requestId: req.requestId },
  });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    if (error.status >= 500) logger.error('request_failed', { requestId: req.requestId, code: error.code, message: error.message });
    else logger.info('request_rejected', { requestId: req.requestId, code: error.code, message: error.message });
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details, requestId: req.requestId },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        details: { fields: Object.fromEntries(error.issues.map((i) => [i.path.join('.') || '_', i.message])) },
        requestId: req.requestId,
      },
    });
    return;
  }

  const anyError = error as { status?: number; statusCode?: number; message?: string; type?: string };
  if (anyError?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'That file or request is too large.', requestId: req.requestId },
    });
    return;
  }

  logger.error('unhandled_error', {
    requestId: req.requestId,
    message: anyError?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : (error as Error)?.stack,
  });

  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again.', requestId: req.requestId },
  });
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  res.setHeader('x-request-id', req.requestId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: duration,
    });
  });
  next();
}
