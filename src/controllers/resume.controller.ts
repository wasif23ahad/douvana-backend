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

/**
 * @desc    Save a tailored resume version
 * @route   POST /api/resume/versions
 * @access  Private
 */
export const createResumeVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { applicationId, name, data, templateId, atsScore } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const version = await prisma.resumeVersion.create({
      data: {
        userId,
        applicationId,
        name,
        data,
        templateId,
        atsScore,
      }
    });

    res.status(201).json({ success: true, data: version });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all resume versions for a user
 * @route   GET /api/resume/versions
 * @access  Private
 */
export const getResumeVersions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { applicationId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const where: any = { userId };
    if (applicationId && typeof applicationId === 'string') {
      where.applicationId = applicationId;
    }

    const versions = await prisma.resumeVersion.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a resume version
 * @route   DELETE /api/resume/versions/:id
 * @access  Private
 */
export const deleteResumeVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify ownership
    const version = await prisma.resumeVersion.findUnique({
      where: { id }
    });

    if (!version || version.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Resume version not found' });
    }

    await prisma.resumeVersion.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Resume version deleted successfully' });
  } catch (error) {
    next(error);
  }
};
