import type { ErrorResponseBody } from '@/lib/contracts';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, field?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.details = details;
  }
}

export function errorResponseBody(error: ApiError): ErrorResponseBody {
  const body: ErrorResponseBody = {
    code: error.code,
    message: error.message,
  };

  if (error.field) {
    body.field = error.field;
  }

  return body;
}

export function ensureApiError(
  error: unknown,
  fallback: {
    status: number;
    code: string;
    message: string;
    field?: string;
  },
) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ApiError(400, 'INVALID_JSON_BODY', 'A solicitação enviada não pôde ser processada.');
  }

  return new ApiError(fallback.status, fallback.code, fallback.message, fallback.field);
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (error) {
    throw ensureApiError(error, {
      status: 400,
      code: 'INVALID_JSON_BODY',
      message: 'A solicitação enviada não pôde ser processada.',
    });
  }
}
