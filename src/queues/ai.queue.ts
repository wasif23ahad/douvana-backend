import { Queue, Worker, Job } from 'bullmq';
import redis from '../lib/redis.js';
import { aiService } from '../services/ai.service.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { Prisma } from '@prisma/client';

const QUEUE_NAME = 'ai-tasks';

// 1. Create Queue
export const aiQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

// 2. Create Worker
export const aiWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { type, data } = job.data;

    if (type === 'GENERATE_RESUME') {
      const { userId, applicationId, templateId } = data;

      logger.info(`Processing resume generation for user ${userId}, app ${applicationId}`);

      // Get User and Application Data
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: { jdAnalysis: true }
      });

      if (!user || !application || !application.jdAnalysis) {
        throw new Error('Required data missing for resume generation');
      }

      // Generate via AI
      const resumeContent = await aiService.generateResume(user, application.jdAnalysis);

      // Save to DB via transaction
      const resume = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const res = await tx.resume.upsert({
          where: { applicationId },
          update: {
            content: resumeContent as any,
            templateId,
          },
          create: {
            userId,
            applicationId,
            templateId,
            title: `Resume for ${application.jobTitle} at ${application.company}`,
            content: resumeContent as any,
          }
        });

        // Log Activity
        await tx.activity.create({
          data: {
            applicationId,
            type: 'RESUME_GENERATED',
            description: 'AI Resume generated and tailored to the job description.',
          }
        });

        // Create Notification
        const notification = await tx.notification.create({
          data: {
            userId,
            title: 'Resume Ready! ✨',
            message: `Your tailored resume for ${application.company} is now available in your workspace.`,
            type: 'AI',
          }
        });

        // Emit SSE
        import('../lib/sse.js').then(({ sseManager }) => {
          sseManager.sendToUser(userId, notification);
        });

        return res;
      });

      return resume;
    }
  },
  { connection: redis }
);

aiWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

aiWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});
