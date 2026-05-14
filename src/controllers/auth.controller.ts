import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
// @ts-ignore
import { AppStatus, Platform } from '@prisma/client';

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as SignOptions['expiresIn'],
  });
};

const generateRefreshToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  });
};

const seedInitialProfileForUser = async (user: any) => {
  if (process.env.NODE_ENV === 'production') return;
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        headline: 'Senior Software Engineer',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Next.js'],
        bio: 'Passionate developer leveraging modern tools and AI workflows to engineer high-performance systems.',
      },
    });

    await prisma.masterResume.create({
      data: {
        userId: user.id,
        data: {
          personalInfo: {
            name: user.name || 'Alex Carter',
            email: user.email,
            phone: '+1 (555) 019-2834',
            linkedin: 'https://linkedin.com/in/alexcarter',
          },
          summary: 'Full Stack Software Engineer with 5+ years of experience building highly scalable applications, specialized backend APIs, and dynamic user interfaces using React, Node.js, and PostgreSQL.',
          experience: [
            {
              id: 'exp-1',
              company: 'Stripe',
              role: 'Backend Engineer',
              dates: '2023 - Present',
              description: 'Architected distributed transaction routing microservices handling 5,000 requests/sec with 99.99% uptime. Optimized SQL joins in reporting pipelines reducing latency by 35%.',
            },
            {
              id: 'exp-2',
              company: 'TechCorp',
              role: 'Full Stack Developer',
              dates: '2021 - 2023',
              description: 'Led the migration of a legacy Angular frontend to Next.js App Router, boosting Lighthouse metrics to 95+. Built role-based analytics dashboards supporting 50K enterprise daily active users.',
            },
          ],
          skills: 'React, TypeScript, Node.js, Next.js, PostgreSQL, Docker, Redis, Kubernetes, AWS',
        },
      },
    });

    await prisma.application.createMany({
      data: [
        {
          userId: user.id,
          jobTitle: 'Senior Full Stack Engineer',
          company: 'Google',
          status: AppStatus.INTERVIEW,
          platform: Platform.LINKEDIN,
          location: 'Mountain View, CA',
          salaryMin: 180000,
          salaryMax: 220000,
          jobDescription: 'We are looking for a Senior Full Stack Engineer to lead new architecture projects focusing on high-performance distributed systems.',
          notes: 'Completed screening call with recruiter. Technical rounds scheduled for next Tuesday.',
        },
        {
          userId: user.id,
          jobTitle: 'Backend Software Engineer',
          company: 'Netflix',
          status: AppStatus.SCREENING,
          platform: Platform.COMPANY_SITE,
          location: 'Los Gatos, CA',
          salaryMin: 190000,
          salaryMax: 240000,
          jobDescription: 'Netflix is looking for specialized backend engineers to optimize media delivery orchestration.',
          notes: 'Applied through referral. Resume parsed and matching keywords detected.',
        },
        {
          userId: user.id,
          jobTitle: 'Frontend Architect',
          company: 'Vercel',
          status: AppStatus.APPLIED,
          platform: Platform.OTHER,
          location: 'Remote',
          salaryMin: 160000,
          salaryMax: 195000,
          jobDescription: 'Seeking frontend architects to evolve the future of Web frameworks and client infrastructure.',
          notes: 'Submitted portfolio and tailored resume variant via platform portal.',
        },
      ],
    });
  } catch (error) {
    console.error('Failed to seed initial profile for user:', error);
  }
};

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password, name } = parsed.data;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    await seedInitialProfileForUser(user);

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
      refreshToken: generateRefreshToken(user.id),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please log in with Google.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user.id),
      refreshToken: generateRefreshToken(user.id),
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ message: 'Refresh token required' });

    const decoded: any = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    res.json({
      token: generateToken(user.id),
      refreshToken: generateRefreshToken(user.id),
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        headline: true,
        skills: true,
        experience: true,
        education: true,
        location: true,
        bio: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: parsed.data,
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        headline: true, location: true, bio: true, linkedinUrl: true,
        githubUrl: true, portfolioUrl: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'Password change is not available for Google accounts' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashed },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Account deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, googleId, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required for Google Login' });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'This account has been deactivated' });
      }
      if (!user.googleId || !user.avatar) {
        user = await prisma.user.update({
          where: { email },
          data: {
            googleId: user.googleId || googleId,
            avatar: user.avatar || avatar,
          },
        });
      }
    } else {
      user = await prisma.user.create({
        data: { email, name, googleId, avatar },
      });
      await seedInitialProfileForUser(user);
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user.id),
      refreshToken: generateRefreshToken(user.id),
    });
  } catch (error) {
    next(error);
  }
};
