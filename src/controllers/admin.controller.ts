import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

export const getAdminStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic counts
    const [userCount, appCount, aiLogCount] = await Promise.all([
      prisma.user.count(),
      prisma.application.count(),
      prisma.aILog.count(),
    ]);

    // Token consumption
    const tokenStats = await prisma.aILog.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
      _avg: {
        latencyMs: true,
      }
    });

    // Health check logic (mocked for now but based on real DB connectivity)
    const health = {
      api: 'Healthy',
      db: 'Healthy',
      redis: 'Healthy',
      ai: 'Healthy'
    };

    res.json({
      totalUsers: userCount,
      totalApplications: appCount,
      aiRequests: aiLogCount,
      tokensUsed: (tokenStats._sum.inputTokens || 0) + (tokenStats._sum.outputTokens || 0),
      avgLatency: tokenStats._avg.latencyMs || 0,
      health
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Admin
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          createdAt: true,
          _count: { select: { applications: true } }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a user's role
 * @route   PATCH /api/admin/users/:id/role
 * @access  Admin
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const role = req.body.role as string;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be USER or ADMIN.' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: role as Role },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/admin/users/:id
 * @access  Admin
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all applications (read-only aggregate view)
 * @route   GET /api/admin/applications
 * @access  Admin
 */
export const getAllApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.application.count()
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get AI usage logs
 * @route   GET /api/admin/logs
 * @access  Admin
 */
export const getAILogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const feature = req.query.feature as string;

    const where: any = {};
    if (feature) where.feature = feature;

    const [logs, total] = await Promise.all([
      prisma.aILog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.aILog.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};
