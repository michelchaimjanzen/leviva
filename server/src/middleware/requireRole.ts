import { getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export type LevivaRole = 'clinician' | 'lab_admin';

/**
 * Reads the role out of the Clerk session's public metadata and rejects
 * the request if it isn't one of `allowedRoles`.
 *
 * IMPORTANT: this assumes Clerk is configured (Dashboard -> Sessions ->
 * Customize session token) to include public metadata in the JWT, e.g.:
 *   { "metadata": "{{user.public_metadata}}" }
 * Without that, sessionClaims.metadata will be undefined and every request
 * will be rejected as unauthorized regardless of the user's real role.
 *
 * Must run AFTER requireAuth() (or another Clerk auth-establishing
 * middleware) in the route's middleware chain — it does not verify the
 * session itself, only checks the role on an already-authenticated request.
 */
export const requireRole = (allowedRoles: LevivaRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { sessionClaims, userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const role = (sessionClaims?.metadata as { role?: LevivaRole } | undefined)?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        error: `Insufficient permissions. This action requires one of: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};