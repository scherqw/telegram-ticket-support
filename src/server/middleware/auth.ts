import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { loadConfig } from '../../config/loader';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface AuthRequest extends Request {
  telegramUser?: TelegramUser;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const initData = req.headers['x-telegram-init-data'] as string;

    if (!initData) {
      res.status(401).json({ error: 'Missing Telegram init data' });
      return;
    }

    const user = validateTelegramWebAppData(initData);

    if (!user) {
      res.status(401).json({ error: 'Invalid Telegram init data' });
      return;
    }

    const config = loadConfig();
    const isTechnician = config.admin.technician_ids.includes(user.id);

    if (!isTechnician) {
      res.status(403).json({ error: 'Access denied: Not a technician' });
      return;
    }

    req.telegramUser = user;
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