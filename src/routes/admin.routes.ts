import { Router } from 'express';
import { 
  getAdminStats, 
  getUsers, 
  updateUserRole,
  deleteUser,
  getAllApplications,
  getAILogs
} from '../controllers/admin.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// Protect all admin routes
router.use(protect);
router.use(adminOnly);

router.get('/stats', getAdminStats);

// User Management (F6.2)
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// All Applications read-only view (F6.3)
router.get('/applications', getAllApplications);

// AI Usage Logs (F6.4)
router.get('/logs', getAILogs);

export default router;
