import { Router } from 'express';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/require-auth.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const authenticatedRequest = request as AuthenticatedRequest;
    const client = createSupabaseUserClient(authenticatedRequest.accessToken);
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', authenticatedRequest.authUser.id)
      .single();

    if (error) {
      throw error;
    }

    return response.json({
      data: { ...data, email: authenticatedRequest.authUser.email ?? null },
    });
  } catch (error) {
    return next(error);
  }
});
