import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
// @ts-ignore - Prisma generated enums sometimes cause false-positive lint errors in the IDE
import { TemplateCategory, TemplateStyle } from '@prisma/client';

export const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, style, search, sort, page = 1, limit = 12 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build filter
    const where: any = { isActive: true };

    if (category) {
      where.category = category as TemplateCategory;
    }

    if (style) {
      where.style = style as TemplateStyle;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { bestFor: { has: search as string } },
      ];
    }

    // Build sort
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { usageCount: 'desc' };
    } else if (sort === 'rating') {
      // Complex sorting by average rating would need a raw query or aggregation
      // For now, let's keep it simple or sort by created date
      orderBy = { createdAt: 'desc' };
    }

    const [templates, total] = await prisma.$transaction([
      prisma.template.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: { reviews: true }
          }
        }
      }),
      prisma.template.count({ where }),
    ]);

    res.json({
      templates,
      pagination: {
        total,
        pages: Math.ceil(total / take),
        currentPage: Number(page),
        limit: take,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const template = await prisma.template.findUnique({
      where: { id: id as string },
      include: {
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { name: true, avatar: true }
            }
          }
        },
        _count: {
          select: { reviews: true }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Calculate average rating manually (or via aggregation in a separate call)
    const aggregate = await prisma.templateReview.aggregate({
      where: { templateId: id as string },
      _avg: { rating: true },
    });

    res.json({
      ...template,
      averageRating: aggregate._avg?.rating || 0,
    });
  } catch (error) {
    next(error);
  }
};
