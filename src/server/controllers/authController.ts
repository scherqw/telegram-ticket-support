import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../../config/loader';

export const login = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const config = loadConfig();

    if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
    }

    // Verify Password against Env Config
    if (password !== config.auth.admin_password) {
       res.status(401).json({ error: 'Invalid credentials' });
       return;
    }

    // Create a "Technician" identity for the session.
    // We use a reserved ID (0) or the owner ID to ensure they have access.
    // This masquerades as a TelegramUser so existing routes work seamlessly.
    const userPayload = {
      id: 0, 
      first_name: 'Web Admin',
      username: 'admin',
      isWebLogin: true
    };

    const token = jwt.sign(userPayload, config.auth.jwt_secret, { 
        expiresIn: '24h' 
    });

    res.json({ 
        success: true,
        token, 
        user: userPayload 
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};