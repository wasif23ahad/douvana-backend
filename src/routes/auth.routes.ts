import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  deleteMe,
  googleLogin,
  refreshToken,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/change-password', protect, changePassword);
router.delete('/me', protect, deleteMe);

export default router;
