import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service.js';
import { aiQueue } from '../queues/ai.queue.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

/**
 * @desc    Analyze JD
 * @route   POST /api/ai/analyze-jd
 */
export const analyzeJD = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jd, applicationId } = req.body;

    if (!jd) {
      return res.status(400).json({ success: false, message: 'JD content is required' });
    }

    const analysis = await aiService.analyzeJD(jd);

    // Save to DB if applicationId is provided
    if (applicationId) {
      await prisma.jDAnalysis.upsert({
        where: { applicationId },
        update: { ...analysis, rawJD: jd },
        create: { ...analysis, applicationId, rawJD: jd },
      });
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger Async Resume Generation
 * @route   POST /api/ai/generate-resume
 */
export const generateResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId, templateId } = req.body;
    const userId = req.user?.id;

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application ID is required' });
    }

    const job = await aiQueue.add('generate-resume', {
      type: 'GENERATE_RESUME',
      data: { userId, applicationId, templateId }
    });

    res.json({
      success: true,
      data: { jobId: job.id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check Job Status
 * @route   GET /api/ai/jobs/:id
 */
export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const job = await aiQueue.getJob(id as string);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const status = await job.getState();
    const result = job.returnvalue;

    res.json({
      success: true,
      data: { id: job.id, status, result },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate Cover Letter (Streaming)
 * @route   POST /api/ai/generate-cover-letter
 */
export const generateCoverLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId } = req.body;
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { jdAnalysis: true }
    });

    if (!user || !application) {
      return res.status(404).json({ success: false, message: 'Data not found' });
    }

    const stream = await aiService.generateCoverLetterStream(user, application);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();
  } catch (error) {
    logger.error('Streaming Error:', error);
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }
};

/**
 * @desc    Calculate Health Score
 * @route   POST /api/ai/health-score
 */
export const calculateHealthScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId } = req.body;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { jdAnalysis: true, resume: true }
    });

    if (!application || !application.jdAnalysis || !application.resume) {
      return res.status(400).json({ success: false, message: 'JD Analysis and Resume required' });
    }

    const score = await aiService.calculateHealthScore(application.resume.content, application.jdAnalysis);

    await prisma.healthScore.upsert({
      where: { applicationId },
      update: score,
      create: { ...score, applicationId },
    });

    res.json({
      success: true,
      data: score,
    });
  } catch (error) {
    next(error);
  }
};
