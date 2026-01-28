import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../../config/loader';
import { authState } from '../../services/authState';
import { Technician } from '../../database/models/Technician';

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

export const generateLinkCode = async (req: Request, res: Response) => {
  try {
    const code = authState.createCode();
    res.json({ code, expires_in: 300 }); // 5 minutes
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate code' });
  }
};

// Long-polling endpoint to wait for linking to complete
export const checkLinkStatus = async (req: Request<{ code: string }>, res: Response) => {
  const { code } = req.params;
  const config = loadConfig();
  const entry = authState.verifyCode(code);

  if (!entry) {
    res.status(404).json({ error: 'Invalid or expired code' });
    return;
  }

  if (entry.status === 'linked' && entry.technician) {
    // Generate a real JWT for this technician
    const token = jwt.sign(
      {
        id: entry.technician.telegramId,
        first_name: entry.technician.firstName,
        username: entry.technician.username
      },
      config.auth.jwt_secret,
      { expiresIn: '30d' }
    );

    // Persist to DB if not exists
    await Technician.findOneAndUpdate(
      { telegramId: entry.technician.telegramId },
      { 
        ...entry.technician,
        linkedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Clear code so it can't be reused
    authState.removeCode(code);

    res.json({
      status: 'linked',
      token,
      user: entry.technician
    });
    return;
  }

  res.json({ status: 'pending' });
};