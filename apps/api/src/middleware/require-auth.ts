import type { NextFunction, Request, Response } from 'express';
import { createSupabaseUserClient } from '../lib/supabase.js';

export type AuthenticatedRequest = Request & {
  accessToken: string;
  authUser: { email?: string; id: string };
};

const unauthenticated = (response: Response) =>
  response.status(401).json({
    error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
  });

export const requireAuth = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const [scheme, accessToken] =
    request.header('authorization')?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !accessToken) {
    return unauthenticated(response);
  }

  try {
    const { data, error } =
      await createSupabaseUserClient(accessToken).auth.getUser(accessToken);

    if (error || !data.user) {
      return unauthenticated(response);
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.accessToken = accessToken;
    authenticatedRequest.authUser = {
      email: data.user.email,
      id: data.user.id,
    };
    return next();
  } catch {
    return response.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Authentication service is not configured.',
      },
    });
  }
};
