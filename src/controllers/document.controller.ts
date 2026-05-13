import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

/**
 * @desc    Save a cover letter
 * @route   POST /api/documents/cover-letter
 * @access  Private
 */
export const createCoverLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { applicationId, content, variant, tone, wordCount, keywordScore } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const coverLetter = await prisma.coverLetter.create({
      data: {
        userId,
        applicationId,
        content,
        variant,
        tone,
        wordCount,
        keywordScore,
      }
    });

    res.status(201).json({ success: true, data: coverLetter });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get cover letters (optionally filtered by application)
 * @route   GET /api/documents/cover-letter
 * @access  Private
 */
export const getCoverLetters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const applicationId = req.query.applicationId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const where: any = { userId };
    if (applicationId && typeof applicationId === 'string') {
      where.applicationId = applicationId;
    }

    const coverLetters = await prisma.coverLetter.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: coverLetters });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a cover letter
 * @route   DELETE /api/documents/cover-letter/:id
 * @access  Private
 */
export const deleteCoverLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const doc = await prisma.coverLetter.findUnique({ where: { id } });

    if (!doc || doc.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Cover letter not found' });
    }

    await prisma.coverLetter.delete({ where: { id } });

    res.json({ success: true, message: 'Cover letter deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save an email draft
 * @route   POST /api/documents/email-draft
 * @access  Private
 */
export const createEmailDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { applicationId, subject, body, emailType } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const emailDraft = await prisma.emailDraft.create({
      data: {
        userId,
        applicationId,
        subject,
        body,
        emailType,
      }
    });

    res.status(201).json({ success: true, data: emailDraft });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get email drafts (optionally filtered by application)
 * @route   GET /api/documents/email-draft
 * @access  Private
 */
export const getEmailDrafts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const applicationId = req.query.applicationId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const where: any = { userId };
    if (applicationId && typeof applicationId === 'string') {
      where.applicationId = applicationId;
    }

    const drafts = await prisma.emailDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: drafts });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an email draft
 * @route   DELETE /api/documents/email-draft/:id
 * @access  Private
 */
export const deleteEmailDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const doc = await prisma.emailDraft.findUnique({ where: { id } });

    if (!doc || doc.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Email draft not found' });
    }

    await prisma.emailDraft.delete({ where: { id } });

    res.json({ success: true, message: 'Email draft deleted' });
  } catch (error) {
    next(error);
  }
};
