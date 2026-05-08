import { Router } from 'express';
import { getAdminStats } from '../controllers/admin.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// Protect all admin routes
router.use(protect);
router.use(adminOnly);

router.get('/stats', getAdminStats);

export default router;
