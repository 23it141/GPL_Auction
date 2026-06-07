import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gpl_auction_super_secret_key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'captain';
    teamCode?: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ message: 'Invalid or expired token' });
      return;
    }
    req.user = user as AuthRequest['user'];
    next();
  });
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

export const requireCaptain = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'captain') {
    res.status(403).json({ message: 'Captain access required' });
    return;
  }
  next();
};
