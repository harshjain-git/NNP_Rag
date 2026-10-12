export interface AuthUser {
  id: string;
  role: string;
}

export interface JwtTokenPayload {
  sub: string;
  role: string;
  iat?: number | undefined;
  exp?: number | undefined;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | undefined;
    }
  }
}
