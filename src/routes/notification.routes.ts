import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { sseManager } from '../lib/sse';

const router = Router();

router.use(protect);

/**
 * @desc    Stream notifications via SSE
 */
router.get('/stream', (req, res) => {
  const userId = req.user?.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseManager.addConnection(userId!, res);

  // Send initial ping
  res.write('data: {"type": "connected"}\n\n');
});

/**
 * @desc    Get all notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Mark notification as read
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await prisma.notification.update({
      where: { id, userId },
      data: { read: true },
    });

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
