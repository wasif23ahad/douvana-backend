import { Router } from 'express';
import authRoutes from './auth.routes.js';
import templateRoutes from './template.routes.js';
import applicationRoutes from './application.routes.js';
import aiRoutes from './ai.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';
import resumeRoutes from './resume.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/applications', applicationRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/resume', resumeRoutes);

export default router;
