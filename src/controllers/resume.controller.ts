import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

/**
 * @desc    Get master resume
 * @route   GET /api/resume/master
 * @access  Private
 */
export const getMasterResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const masterResume = await prisma.masterResume.findUnique({
      where: { userId }
    });

    if (!masterResume) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: masterResume.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update master resume
 * @route   PUT /api/resume/master
 * @access  Private
 */
export const updateMasterResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { data } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const masterResume = await prisma.masterResume.upsert({
      where: { userId },
      update: {
        data
      },
      create: {
        userId,
        data
      }
    });

    res.json({
      success: true,
      data: masterResume.data
    });
  } catch (error) {
    next(error);
  }
};
