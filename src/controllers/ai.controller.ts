import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { redis } from '../lib/redis';

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
    const applicationId = req.params.applicationId as string;
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
    // Accept both formats: new { history, context } and legacy { message, history }
    const { history = [], context: clientContext } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Fetch server-side user context (authoritative)
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

    const serverContext = {
      totalApplications: totalApps,
      statusBreakdown: stats.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s._count }), {}),
      activeCount: stats
        .filter((s: any) => !['REJECTED', 'WITHDRAWN'].includes(s.status))
        .reduce((acc: any, s: any) => acc + s._count, 0),
      responseRate: totalApps > 0
        ? Math.round((stats.filter((s: any) => ['INTERVIEW', 'OFFER'].includes(s.status)).reduce((a: any, s: any) => a + s._count, 0) / totalApps) * 100)
        : 0,
      skills: (masterResume?.data as any)?.skills || [],
      experienceLevel: 'Mid-level',
      recentApplications: recentApps.map((a: any) => ({ jobTitle: a.jobTitle, companyName: a.company, status: a.status }))
    };

    // Merge client-provided context (non-sensitive info like draft messages) with server context
    const context = { ...clientContext, ...serverContext };

    await aiService.chatSSE(history, context, res, userId);
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

    // Check Redis cache first (6-hour TTL)
    const cacheKey = `pipeline_health:${userId}:${new Date().toDateString()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit: pipeline health for user ${userId}`);
      return res.json({ success: true, data: JSON.parse(cached), cached: true });
    }

    // Aggregate stats for health check
    const apps = await prisma.application.findMany({ where: { userId } });
    const stats = {
      total: apps.length,
      byStatus: apps.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      responseRate: apps.length > 0
        ? Math.round((apps.filter((a: any) => ['INTERVIEW', 'OFFER'].includes(a.status)).length / apps.length) * 100)
        : 0,
      daysSinceLastApplication: apps.length > 0
        ? Math.floor((Date.now() - new Date(apps.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };

    const healthData = await aiService.analyzePipelineHealth(stats, userId);

    // Cache result for 6 hours
    await redis.setex(cacheKey, 6 * 60 * 60, JSON.stringify(healthData));

    res.json({ success: true, data: healthData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent: Parse Resume PDF
 * @route   POST /api/ai/parse-resume
 */
export const parseResumePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }

    const dataBuffer = file.buffer;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
    const pdfData = await pdfParse(dataBuffer);
    const parsedResume = await aiService.parseResumeData(pdfData.text, req.user?.id);

    res.json({ success: true, data: parsedResume });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Agent: Generate Tailored Resume
 * @route   POST /api/ai/generate-resume
 */
export const generateResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId, templateId } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Since we don't have BullMQ yet, we simulate an async job queue using Redis
    // and execute the task asynchronously.
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initial status
    await redis.setex(`job:${jobId}`, 3600, JSON.stringify({ status: 'processing' }));

    // Run async without blocking response
    setImmediate(async () => {
      try {
        const application = await prisma.application.findUnique({ where: { id: applicationId } });
        const masterResume = await prisma.masterResume.findUnique({ where: { userId } });

        if (!application || !masterResume) {
          throw new Error('Application or Master Resume not found');
        }

        const jdAnalysis = application.parsedData || { 
          roleInsights: application.jobTitle, 
          requiredSkills: [] 
        };

        const result = await aiService.generateResume(masterResume.data, jdAnalysis);

        // Store result
        await redis.setex(`job:${jobId}`, 3600, JSON.stringify({ status: 'completed', result }));
      } catch (error: any) {
        logger.error('Background Resume Gen error:', error);
        await redis.setex(`job:${jobId}`, 3600, JSON.stringify({ status: 'failed', error: error.message }));
      }
    });

    res.json({ success: true, data: { jobId } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Job Status
 * @route   GET /api/ai/jobs/:jobId
 */
export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const jobDataStr = await redis.get(`job:${jobId}`);

    if (!jobDataStr) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, data: JSON.parse(jobDataStr) });
  } catch (error) {
    next(error);
  }
};
