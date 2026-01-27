import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../../config/loader';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface AuthRequest extends Request {
  user?: TelegramUser;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const initData = req.headers['x-telegram-init-data'] as string;
    const config = loadConfig();

    let user: TelegramUser | null = null;
    let isJwtAuth = false;

    // 1. Check for Bearer Token (JWT)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, config.auth.jwt_secret) as TelegramUser;
        user = decoded;
        isJwtAuth = true;
      } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
    } 
    // 2. Check for Telegram Init Data
    else if (initData) {
      user = validateTelegramWebAppData(initData);
      if (!user) {
        res.status(401).json({ error: 'Invalid Telegram init data' });
        return;
      }
    } 
    // 3. No credentials
    else {
      res.status(401).json({ error: 'Missing authentication credentials' });
      return;
    }

    // Access Control
    if (!isJwtAuth) {
        const isTechnician = config.admin.technician_ids.includes(user.id);
        if (!isTechnician) {
            res.status(403).json({ error: 'Access denied: Not a technician' });
            return;
        }
    }

    // Assign to standard req.user
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

function validateTelegramWebAppData(initData: string): TelegramUser | null {
  const config = loadConfig();
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.bot.token)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(sortedParams)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null;
  }

  const userParam = params.get('user');
  if (!userParam) return null;

  return JSON.parse(userParam);
}