import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { Prisma } from '@prisma/client';

/**
 * @desc    Get all applications for the current user
 * @route   GET /api/applications
 * @access  Private
 */
export const getApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { status, search, page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { jobTitle: { contains: String(search), mode: 'insensitive' } },
        { company: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { activities: true, contacts: true },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new application
 * @route   POST /api/applications
 * @access  Private
 */
export const createApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { 
      jobTitle, 
      company, 
      status, 
      location, 
      jobUrl, 
      salaryMin, 
      salaryMax, 
      priority,
      notes 
    } = req.body;

    if (!jobTitle || !company) {
      return res.status(400).json({ success: false, message: 'Job title and company are required' });
    }

    const application = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const app = await tx.application.create({
        data: {
          userId: userId!,
          jobTitle,
          company,
          status: status || 'SAVED',
          location,
          jobUrl,
          salaryMin,
          salaryMax,
          priority: priority || 'MEDIUM',
          notes,
        },
      });

      // Create initial activity
      await tx.activity.create({
        data: {
          applicationId: app.id,
          type: 'APPLICATION_CREATED',
          description: `Applied to ${jobTitle} at ${company}`,
        },
      });

      return app;
    });

    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single application detail
 * @route   GET /api/applications/:id
 * @access  Private
 */
export const getApplicationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const application = await prisma.application.findFirst({
      where: { id, userId },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        contacts: true,
        resume: true,
        jdAnalysis: true,
        healthScore: true,
      },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update application
 * @route   PUT /api/applications/:id
 * @access  Private
 */
export const updateApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;
    const updateData = req.body;

    const application = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedApplication,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update application status (Kanban drag-drop)
 * @route   PATCH /api/applications/:id/status
 * @access  Private
 */
export const updateApplicationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const userId = req.user?.id;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const application = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const updatedApplication = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const app = await tx.application.update({
        where: { id },
        data: { status },
      });

      await tx.activity.create({
        data: {
          applicationId: id,
          type: 'STATUS_CHANGE',
          description: `Status changed from ${application.status} to ${status}`,
          metadata: { from: application.status, to: status },
        },
      });

      return app;
    });

    res.json({
      success: true,
      data: updatedApplication,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete application
 * @route   DELETE /api/applications/:id
 * @access  Private
 */
export const deleteApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const application = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    await prisma.application.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Application deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get application activity timeline
 * @route   GET /api/applications/:id/activities
 * @access  Private
 */
export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const activities = await prisma.activity.findMany({
      where: { 
        applicationId: id,
        application: { userId }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};
