import { Router } from 'express';
import authRoutes from './auth.routes';
import templateRoutes from './template.routes';
import applicationRoutes from './application.routes';
import aiRoutes from './ai.routes';
import notificationRoutes from './notification.routes';
import adminRoutes from './admin.routes';
import resumeRoutes from './resume.routes';
import documentRoutes from './document.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/applications', applicationRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/resume', resumeRoutes);
router.use('/documents', documentRoutes);

export default router;
