import type { ErrorRequestHandler } from 'express';

type SupabaseError = {
  code?: string;
  details?: string;
  message?: string;
  status?: number;
};

const getErrorResponse = (error: SupabaseError) => {
  switch (error.code) {
    case 'PGRST116':
      return {
        status: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found.',
            details: {},
          },
        },
      };
    case '42501':
      return {
        status: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this resource.',
            details: {},
          },
        },
      };
    case '23505':
      return {
        status: 409,
        body: {
          error: {
            code: 'CONFLICT',
            message: 'The requested resource conflicts with existing data.',
            details: {},
          },
        },
      };
    case '22P02':
      return {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The request contains invalid data.',
            details: {},
          },
        },
      };
    default:
      return {
        status: error.status && error.status >= 400 ? error.status : 500,
        body: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            details: {},
          },
        },
      };
  }
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  console.error(error);
  const result = getErrorResponse(error as SupabaseError);
  response.status(result.status).json(result.body);
};
