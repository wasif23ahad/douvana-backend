import { Router } from 'express';
import { register, login, getMe, googleLogin, refreshToken } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);

export default router;
