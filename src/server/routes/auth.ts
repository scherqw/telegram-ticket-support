import { Router } from 'express';
import { login, generateLinkCode, checkLinkStatus } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', login);

router.get('/link-code', authMiddleware, generateLinkCode);
router.get('/link-status/:code', authMiddleware, checkLinkStatus);

export { router as authRoutes };