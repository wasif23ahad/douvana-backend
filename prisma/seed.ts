// @ts-ignore - Prisma generated enums sometimes cause false-positive lint errors in the IDE
import { PrismaClient, Role, TemplateCategory, TemplateStyle } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');

  // 1. Clear existing data
  await prisma.templateReview.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.application.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const hashedPassword = await bcrypt.hash('Admin@1234', 10);
  const demoHashedPassword = await bcrypt.hash('Demo@1234', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@drouvana.com',
      password: hashedPassword,
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@drouvana.com',
      password: demoHashedPassword,
      name: 'Demo User',
      role: Role.USER,
      headline: 'Full Stack Developer',
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      bio: 'Passionate developer looking for new opportunities in fintech.',
    },
  });

  console.log('✅ Users seeded');

  // 3. Create Templates
  const templates = [
    {
      title: 'Nova — Modern Tech',
      slug: 'nova-modern-tech',
      description: 'A clean, single-column layout optimized for software engineering and technical roles. High ATS compatibility.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/nova-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/nova-1.png'],
      category: TemplateCategory.TECH,
      style: TemplateStyle.MODERN,
      atsScore: 94,
      bestFor: ['Software Engineer', 'Frontend Developer', 'Data Scientist'],
      sections: ['Summary', 'Experience', 'Skills', 'Education', 'Projects'],
      usageCount: 1250,
    },
    {
      title: 'Atlas — Executive Professional',
      slug: 'atlas-executive',
      description: 'Sophisticated design for senior leadership and executive roles. Emphasizes achievements and impact.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/atlas-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/atlas-1.png'],
      category: TemplateCategory.EXECUTIVE,
      style: TemplateStyle.CLASSIC,
      atsScore: 88,
      bestFor: ['CEO', 'Project Manager', 'Director of Operations'],
      sections: ['Executive Summary', 'Core Competencies', 'Professional Experience', 'Education'],
      usageCount: 840,
    },
    {
      title: 'Canvas — Creative Portfolio',
      slug: 'canvas-creative',
      description: 'Bold and visual layout for designers, artists, and creative professionals. Focuses on visual impact.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/canvas-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/canvas-1.png'],
      category: TemplateCategory.CREATIVE,
      style: TemplateStyle.BOLD,
      atsScore: 72,
      bestFor: ['UI/UX Designer', 'Graphic Designer', 'Art Director'],
      sections: ['Bio', 'Portfolio Highlights', 'Work History', 'Tools'],
      usageCount: 2100,
    },
    {
      title: 'Minimal — Clean & Simple',
      slug: 'minimal-clean',
      description: 'Ultra-minimalist design that puts your content first. Perfect for any industry.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/minimal-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/minimal-1.png'],
      category: TemplateCategory.GENERAL,
      style: TemplateStyle.MINIMAL,
      atsScore: 96,
      bestFor: ['Customer Success', 'Administrative Assistant', 'General Roles'],
      sections: ['Experience', 'Education', 'Skills'],
      usageCount: 3500,
    },
    {
      title: 'Financier — Data Driven',
      slug: 'financier-data',
      description: 'Structured and formal layout optimized for finance and accounting professionals.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/financier-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/financier-1.png'],
      category: TemplateCategory.FINANCE,
      style: TemplateStyle.CLASSIC,
      atsScore: 92,
      bestFor: ['Financial Analyst', 'Accountant', 'Investment Banker'],
      sections: ['Summary', 'Professional Experience', 'Skills', 'Certifications'],
      usageCount: 620,
    },
    {
      title: 'MarketMaster — Performance Focus',
      slug: 'marketmaster-marketing',
      description: 'Dynamic layout that highlights metrics and marketing achievements.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/marketing-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/marketing-1.png'],
      category: TemplateCategory.MARKETING,
      style: TemplateStyle.MODERN,
      atsScore: 85,
      bestFor: ['Marketing Manager', 'SEO Specialist', 'Content Strategist'],
      sections: ['Impact Summary', 'Experience', 'Technical Skills', 'Education'],
      usageCount: 1100,
    },
    {
      title: 'Elite — Two Column Modern',
      slug: 'elite-two-column',
      description: 'A stylish two-column layout that balances aesthetics with information density.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/elite-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/elite-1.png'],
      category: TemplateCategory.TECH,
      style: TemplateStyle.MODERN,
      atsScore: 82,
      bestFor: ['Product Manager', 'Systems Architect', 'Lead Developer'],
      sections: ['Profile', 'Core Skills', 'Work History', 'Projects', 'Education'],
      usageCount: 1800,
    },
    {
      title: 'Legacy — Traditional Professional',
      slug: 'legacy-traditional',
      description: 'The standard professional resume. Timeless and universally accepted.',
      previewImage: 'https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/legacy-preview.png',
      images: ['https://res.cloudinary.com/dmvfa61je/image/upload/v1715000000/templates/legacy-1.png'],
      category: TemplateCategory.GENERAL,
      style: TemplateStyle.CLASSIC,
      atsScore: 98,
      bestFor: ['Legal', 'Education', 'Healthcare'],
      sections: ['Professional Summary', 'Experience', 'Education', 'Awards'],
      usageCount: 4200,
    },
  ];

  for (const template of templates) {
    await prisma.template.create({ data: template });
  }

  console.log('✅ Templates seeded');

  // 4. Create some reviews for the first template
  await prisma.templateReview.createMany({
    data: [
      {
        rating: 5,
        comment: 'Excellent template! Helped me get 3 interviews in a week.',
        userId: demoUser.id,
        templateId: (await prisma.template.findUnique({ where: { slug: 'nova-modern-tech' } }))!.id,
      },
      {
        rating: 4,
        comment: 'Very clean design, though I wish there were more color options.',
        userId: admin.id,
        templateId: (await prisma.template.findUnique({ where: { slug: 'nova-modern-tech' } }))!.id,
      },
    ],
  });

  console.log('✅ Reviews seeded');
  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
