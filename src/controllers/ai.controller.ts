import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service.js';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';

/**
 * @desc    Agent 1: Analyze Job Description (Non-streaming)
 * @route   POST /api/ai/parse-jd
 */
export const parseJD = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jd, applicationId } = req.body;
    const userId = req.user?.id;

    if (!jd) {
      return res.status(400).json({ success: false, message: 'Job description text is required' });
    }

    const parsedData = await aiService.parseJD(jd, userId);

    if (applicationId) {
      await prisma.application.update({
        where: { id: applicationId },
        data: { parsedData }
      });
    }

    res.json({ success: true, data: parsedData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent 2: ATS Analyzer (Streaming SSE)
 * @route   GET /api/ai/analyze-resume/sse/:applicationId
 */
export const analyzeResumeSSE = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true }
    });

    if (!application || application.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const masterResume = await prisma.masterResume.findUnique({
      where: { userId }
    });

    if (!masterResume) {
      return res.status(400).json({ success: false, message: 'Master resume not found' });
    }

    await aiService.analyzeResumeSSE(
      masterResume.data,
      application.jobDescription || '',
      res,
      userId
    );
  } catch (error) {
    logger.error('ATS Analyzer SSE Controller Error:', error);
    if (!res.headersSent) next(error);
  }
};

/**
 * @desc    Agent 3: Cover Letter Generator (Streaming SSE)
 * @route   POST /api/ai/generate-cover-letter/sse
 */
export const generateCoverLetterSSE = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId, tone, customInstructions } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const application = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const masterResume = await prisma.masterResume.findUnique({
      where: { userId }
    });

    const params = {
      jobTitle: application.jobTitle,
      companyName: application.company,
      jobDescription: application.jobDescription,
      tone,
      customInstructions,
      resumeSummary: masterResume?.data || {}
    };

    await aiService.generateCoverLetterSSE(params, res, userId);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent 4: Email Drafting (Non-streaming)
 * @route   POST /api/ai/generate-email
 */
export const generateEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, jobTitle, company, context } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const emailData = await aiService.generateEmail({ type, jobTitle, company, context }, userId);
    res.json({ success: true, data: emailData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent 5: Career Coach (Streaming SSE)
 * @route   POST /api/ai/chat/sse
 */
export const chatSSE = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // 1. Fetch user context for the coach
    const [totalApps, stats, recentApps, masterResume] = await Promise.all([
      prisma.application.count({ where: { userId } }),
      prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: true
      }),
      prisma.application.findMany({
        where: { userId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { jobTitle: true, company: true, status: true }
      }),
      prisma.masterResume.findUnique({ where: { userId } })
    ]);

    const context = {
      totalApplications: totalApps,
      statusBreakdown: stats.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s._count }), {}),
      activeCount: stats.filter((s: any) => s.status !== 'REJECTED' && s.status !== 'WITHDRAWN').reduce((acc: any, s: any) => acc + s._count, 0),
      responseRate: 20, // TODO: Calculate actual rate
      skills: (masterResume?.data as any)?.skills || [],
      experienceLevel: 'Mid-level', // TODO: Extract from resume
      recentApplications: recentApps.map((a: any) => ({ jobTitle: a.jobTitle, companyName: a.company, status: a.status }))
    };

    // 2. Start streaming
    const fullHistory = [...history, { role: 'user', content: message }];
    await aiService.chatSSE(fullHistory, context, res, userId);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent 6: Pipeline Health Analysis
 * @route   GET /api/ai/pipeline-health
 */
export const analyzePipelineHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Aggregate stats for health check
    const apps = await prisma.application.findMany({ where: { userId } });
    const stats = {
      total: apps.length,
      byStatus: apps.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      // Add more stats as needed
    };

    const healthData = await aiService.analyzePipelineHealth(stats, userId);
    res.json({ success: true, data: healthData });
  } catch (error) {
    next(error);
  }
};
