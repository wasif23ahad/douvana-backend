import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { aiService } from '../services/ai.service';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { Prisma } from '@prisma/client';

const QUEUE_NAME = 'ai-tasks';

if (!redis.raw) {
  logger.warn('Redis unavailable — BullMQ queue disabled');
}

export const aiQueue = redis.raw
  ? new Queue(QUEUE_NAME, { connection: redis.raw })
  : null;

export const aiWorker = redis.raw
  ? new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const { type, data } = job.data;

        if (type === 'GENERATE_RESUME') {
          const { userId, applicationId, templateId } = data;

          logger.info(`Processing resume generation for user ${userId}, app ${applicationId}`);

          const user = await prisma.user.findUnique({ where: { id: userId } });
          const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { jdAnalysis: true },
          });

          if (!user || !application || !application.jdAnalysis) {
            throw new Error('Required data missing for resume generation');
          }

          const resumeContent = await aiService.generateResume(user, application.jdAnalysis);

          const resume = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const res = await tx.resume.upsert({
              where: { applicationId },
              update: { content: resumeContent as any, templateId },
              create: {
                userId,
                applicationId,
                templateId,
                title: `Resume for ${application.jobTitle} at ${application.company}`,
                content: resumeContent as any,
              },
            });

            await tx.activity.create({
              data: {
                applicationId,
                type: 'RESUME_GENERATED',
                description: 'AI Resume generated and tailored to the job description.',
              },
            });

            const notification = await tx.notification.create({
              data: {
                userId,
                title: 'Resume Ready! ✨',
                message: `Your tailored resume for ${application.company} is now available in your workspace.`,
                type: 'AI',
              },
            });

            import('../lib/sse').then(({ sseManager }) => {
              sseManager.sendToUser(userId, notification);
            });

            return res;
          });

          return resume;
        }
      },
      { connection: redis.raw }
    )
  : null;

if (aiWorker) {
  aiWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  aiWorker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });
}