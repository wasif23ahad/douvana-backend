/**
 * Deterministic ATS Scoring Engine
 *
 * Computes a real, explainable ATS compatibility score from raw resume + JD text.
 * Used both as a standalone fallback when the AI is unavailable, and as a
 * sanity baseline merged into AI responses (so the UI never shows score 0).
 *
 * Scoring rubric (weights sum to 100):
 *   - Keyword coverage (40 pts):   how many JD keywords appear in the resume
 *   - Section completeness (15):    summary/experience/skills/education present
 *   - Action verbs (10):            % of bullet-style lines starting with strong verbs
 *   - Quantification (10):          % of bullets containing numbers/percentages
 *   - Length & density (10):        word count between 350 and 1200
 *   - Formatting cleanliness (10):  no excessive bullets/symbols/emojis
 *   - JD alignment (5):             explicit role/company/title hints present
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'just', 'don', 'now', 'as', 'of', 'if', 'because',
  'while', 'job', 'role', 'work', 'team', 'experience', 'years', 'year',
  'ability', 'strong', 'good', 'excellent', 'including', 'plus', 'preferred',
  'required', 'requirements', 'responsibilities', 'qualifications', 'skills',
  'looking', 'seeking', 'candidate', 'will', 'must', 'should', 'company',
  'opportunity', 'position', 'apply', 'join', 'help', 'across', 'within',
]);

const ACTION_VERBS = new Set([
  'achieved', 'accelerated', 'architected', 'automated', 'authored', 'built',
  'collaborated', 'created', 'cut', 'decreased', 'delivered', 'deployed', 'designed',
  'developed', 'directed', 'drove', 'engineered', 'enhanced', 'established',
  'executed', 'expanded', 'generated', 'grew', 'implemented', 'improved',
  'increased', 'initiated', 'innovated', 'integrated', 'launched', 'led',
  'managed', 'migrated', 'modernized', 'optimized', 'orchestrated', 'organized',
  'oversaw', 'pioneered', 'planned', 'produced', 'programmed', 'reduced',
  'refactored', 'released', 'researched', 'resolved', 'restructured', 'revamped',
  'scaled', 'shipped', 'simplified', 'spearheaded', 'streamlined', 'supervised',
  'transformed', 'troubleshot', 'unified', 'upgraded', 'wrote', 'analyzed',
  'authored', 'coordinated', 'defined', 'evaluated', 'executed', 'facilitated',
  'forecasted', 'identified', 'maintained', 'mentored', 'modelled', 'negotiated',
  'partnered', 'presented', 'prioritized', 'reviewed', 'standardized', 'supported',
  'tested', 'trained', 'validated',
]);

const SECTION_HEADERS = {
  summary: /\b(summary|profile|objective|about\s*me)\b/i,
  experience: /\b(experience|employment|work\s*history|professional\s*background|career)\b/i,
  skills: /\b(skills|technologies|tech\s*stack|technical\s*skills|competencies|tools)\b/i,
  education: /\b(education|academic|degree|university|college|qualifications)\b/i,
  projects: /\b(projects|portfolio|side\s*projects|personal\s*projects)\b/i,
  certifications: /\b(certifications?|certificates|licenses?)\b/i,
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.\-/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function uniqueTerms(tokens: string[], minLen = 2): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (t.length < minLen) continue;
    if (STOPWORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * Extract candidate keyword phrases from a job description.
 * Picks single tokens, two-word and three-word noun-phrase-like sequences,
 * and known multi-word tech terms.
 */
export function extractJDKeywords(jd: string, max = 40): string[] {
  const tokens = tokenize(jd);
  const counts = new Map<string, number>();

  // Single significant tokens
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  // Bigrams that look like noun phrases (skip if any stopwords)
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    if (a.length < 3 || b.length < 3) continue;
    const phrase = `${a} ${b}`;
    counts.set(phrase, (counts.get(phrase) || 0) + 2); // bigrams scored higher
  }

  // Boost known multi-word tech / role terms
  const KNOWN_PHRASES = [
    'machine learning', 'deep learning', 'natural language', 'computer vision',
    'data science', 'data engineering', 'data analysis', 'data visualization',
    'cloud infrastructure', 'distributed systems', 'micro services', 'microservices',
    'continuous integration', 'continuous deployment', 'rest api', 'restful api',
    'graphql', 'grpc', 'event driven', 'message queue', 'unit testing',
    'integration testing', 'system design', 'object oriented', 'functional programming',
    'agile methodologies', 'scrum master', 'product manager', 'software engineer',
    'frontend developer', 'backend developer', 'full stack', 'full-stack',
    'devops', 'sre', 'site reliability', 'infrastructure as code', 'kubernetes',
    'docker', 'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci',
    'aws lambda', 'serverless', 'bigquery', 'redshift', 'spark', 'kafka', 'rabbitmq',
    'postgresql', 'mongodb', 'redis', 'elasticsearch', 'snowflake',
    'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'remix',
    'node.js', 'express', 'nestjs', 'fastapi', 'django', 'flask', 'spring boot',
    'typescript', 'javascript', 'python', 'java', 'golang', 'rust', 'kotlin',
    'tailwind', 'styled components', 'redux', 'tanstack query', 'zustand',
  ];
  const lowerJD = jd.toLowerCase();
  for (const phrase of KNOWN_PHRASES) {
    if (lowerJD.includes(phrase)) counts.set(phrase, (counts.get(phrase) || 5) + 5);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
}

function detectSections(resume: string) {
  const present: Record<string, boolean> = {};
  for (const [section, regex] of Object.entries(SECTION_HEADERS)) {
    present[section] = regex.test(resume);
  }
  return present;
}

function getBulletLines(resume: string): string[] {
  return resume
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 20 && l.length < 400)
    .filter(l => /^[\-•▪◦*●·]/.test(l) || /^\d+[.)]\s/.test(l) || /^[A-Z]/.test(l));
}

function actionVerbScore(bullets: string[]): number {
  if (!bullets.length) return 50;
  let strong = 0;
  for (const b of bullets) {
    const first = b.replace(/^[\-•▪◦*●·\d.)\s]+/, '').split(/\s+/)[0]?.toLowerCase() || '';
    if (ACTION_VERBS.has(first)) strong++;
  }
  return Math.min(100, Math.round((strong / bullets.length) * 130));
}

function quantificationScore(bullets: string[]): number {
  if (!bullets.length) return 40;
  let quantified = 0;
  for (const b of bullets) {
    if (/\b\d+([.,]\d+)?\s*(%|percent|x|k|m|million|billion|users?|requests?|hours?|days?|months?|weeks?|years?|ms|seconds?)?\b/i.test(b)) quantified++;
    else if (/\$\d/.test(b)) quantified++;
  }
  return Math.min(100, Math.round((quantified / bullets.length) * 140));
}

function formattingScore(resume: string): number {
  let score = 100;
  // Excess emojis or decorative symbols hurt ATS parsers
  const emojiCount = (resume.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 5) score -= Math.min(30, emojiCount * 2);
  // Tables/columns are unparseable — heuristic: many tab-separated lines
  const tabbedLines = resume.split('\n').filter(l => l.includes('\t')).length;
  if (tabbedLines > 5) score -= 15;
  // Image/graphic reference (alt text leftovers)
  if (/\[image\]|<img|\.png|\.jpg/i.test(resume)) score -= 10;
  // Excessive uppercase shouting
  const totalAlpha = (resume.match(/[a-zA-Z]/g) || []).length;
  const upperAlpha = (resume.match(/[A-Z]/g) || []).length;
  if (totalAlpha > 0 && upperAlpha / totalAlpha > 0.4) score -= 15;
  return Math.max(40, score);
}

function lengthScore(wordCount: number): number {
  if (wordCount < 150) return 30;
  if (wordCount < 250) return 60;
  if (wordCount <= 1200) return 100;
  if (wordCount <= 1600) return 80;
  return 60;
}

export interface ATSScoringResult {
  ats_score: number;
  keyword_match_rate: number;
  present_keywords: string[];
  missing_keywords: string[];
  section_scores: {
    summary: number;
    experience: number;
    skills: number;
    education: number;
  };
  strengths: string[];
  overall_suggestions: string[];
  breakdown: {
    keyword: number;
    sections: number;
    action_verbs: number;
    quantification: number;
    length: number;
    formatting: number;
    alignment: number;
  };
}

/**
 * Run the deterministic ATS scoring engine.
 * Returns an ATS-shaped object suitable as a fallback or as a baseline floor for AI scoring.
 */
export function scoreResumeAgainstJD(
  resumeText: string,
  jobDescription: string,
  jobTitle?: string
): ATSScoringResult {
  const resumeLower = resumeText.toLowerCase();
  const jdKeywords = extractJDKeywords(jobDescription);

  // Keyword matching (single keyword OR phrase substring)
  const present: string[] = [];
  const missing: string[] = [];
  for (const kw of jdKeywords) {
    if (kw.includes(' ')) {
      if (resumeLower.includes(kw)) present.push(kw);
      else missing.push(kw);
    } else {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(resumeLower)) present.push(kw);
      else missing.push(kw);
    }
  }
  const totalKw = jdKeywords.length || 1;
  const keywordRate = present.length / totalKw;
  const keywordScore = Math.round(keywordRate * 100);

  // Sections
  const sections = detectSections(resumeText);
  const sectionsCount = ['summary', 'experience', 'skills', 'education']
    .filter(s => sections[s]).length;
  const sectionScore = Math.round((sectionsCount / 4) * 100);

  // Section-level scoring
  const summaryMatch = resumeText.match(/(summary|profile|objective)([\s\S]{0,800})/i);
  const summaryText = summaryMatch?.[2] || '';
  const summaryWords = summaryText.split(/\s+/).filter(Boolean).length;
  const summaryScore = sections.summary
    ? Math.min(100, Math.round(60 + Math.min(40, summaryWords))) - (summaryWords < 30 ? 25 : 0)
    : 35;

  const expMatch = resumeText.match(/(experience|employment|work\s*history)([\s\S]+)/i);
  const expText = expMatch?.[2] || resumeText;
  const expBullets = getBulletLines(expText);
  const experienceScore = sections.experience
    ? Math.round(40 + Math.min(60, expBullets.length * 10))
    : 30;

  const skillsScore = sections.skills
    ? Math.min(100, Math.round(50 + keywordRate * 50))
    : 35;

  const educationScore = sections.education ? 90 : 40;

  // Action verbs and quantification
  const allBullets = getBulletLines(resumeText);
  const actionScore = actionVerbScore(allBullets);
  const quantScore = quantificationScore(allBullets);

  // Length
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const lengScore = lengthScore(wordCount);

  // Formatting
  const fmtScore = formattingScore(resumeText);

  // Alignment hints (job title presence in resume)
  let alignmentScore = 50;
  if (jobTitle) {
    const jobTitleLower = jobTitle.toLowerCase();
    if (resumeLower.includes(jobTitleLower)) alignmentScore = 100;
    else {
      const titleParts = jobTitleLower.split(/\s+/).filter(p => p.length > 3 && !STOPWORDS.has(p));
      const matches = titleParts.filter(p => resumeLower.includes(p)).length;
      alignmentScore = titleParts.length ? Math.round((matches / titleParts.length) * 100) : 50;
    }
  }

  // Weighted composite (weights sum to 100)
  const composite = Math.round(
    keywordScore * 0.40 +
    sectionScore * 0.15 +
    actionScore * 0.10 +
    quantScore * 0.10 +
    lengScore * 0.10 +
    fmtScore * 0.10 +
    alignmentScore * 0.05
  );

  // Build strengths and suggestions
  const strengths: string[] = [];
  if (keywordScore >= 70) strengths.push(`Strong keyword alignment — ${present.length}/${totalKw} of the job's key terms appear in your resume.`);
  if (actionScore >= 75) strengths.push('Bullets begin with strong action verbs that recruiters scan for.');
  if (quantScore >= 70) strengths.push('Achievements are well-quantified with concrete metrics.');
  if (sectionsCount === 4) strengths.push('All standard ATS sections (summary, experience, skills, education) are present.');
  if (fmtScore >= 90) strengths.push('Clean, parser-friendly formatting with no problematic symbols or layouts.');
  if (alignmentScore >= 80 && jobTitle) strengths.push(`Resume directly references the target role ("${jobTitle}").`);
  if (!strengths.length) strengths.push('Resume covers the basic structure — refining it with the suggestions below will lift your match rate quickly.');

  const suggestions: string[] = [];
  if (missing.length) {
    const top = missing.slice(0, 6).join(', ');
    suggestions.push(`Add these high-impact keywords from the job description where they truthfully apply: ${top}.`);
  }
  if (sectionsCount < 4) {
    const missingSecs = ['summary', 'experience', 'skills', 'education'].filter(s => !sections[s]);
    suggestions.push(`Add a clearly labeled section for: ${missingSecs.join(', ')} — ATS parsers look for these exact headers.`);
  }
  if (quantScore < 60) suggestions.push('Add numeric impact to your bullets (%, $, users, requests/sec) — quantified results outperform descriptive ones.');
  if (actionScore < 60) suggestions.push('Start more bullets with strong action verbs (Architected, Reduced, Shipped, Optimized) instead of "Responsible for".');
  if (lengScore < 80) suggestions.push(wordCount < 250
    ? 'Expand your resume — under 250 words signals an incomplete profile to ATS systems.'
    : 'Trim to 1–2 pages (≈350–1200 words) — anything longer hurts ATS extraction quality.');
  if (fmtScore < 80) suggestions.push('Simplify formatting — remove emojis, tables, and image references that confuse ATS parsers.');
  if (alignmentScore < 50 && jobTitle) suggestions.push(`Consider mentioning the target role ("${jobTitle}") in your summary or headline.`);
  if (!suggestions.length) suggestions.push('Your resume is well-tailored. Consider adding 1–2 more keywords from the job description for maximum ATS extraction.');

  return {
    ats_score: Math.max(15, Math.min(100, composite)),
    keyword_match_rate: Math.round(keywordRate * 100) / 100,
    present_keywords: present.slice(0, 25),
    missing_keywords: missing.slice(0, 25),
    section_scores: {
      summary: Math.max(20, Math.min(100, summaryScore)),
      experience: Math.max(20, Math.min(100, experienceScore)),
      skills: Math.max(20, Math.min(100, skillsScore)),
      education: Math.max(20, Math.min(100, educationScore)),
    },
    strengths,
    overall_suggestions: suggestions,
    breakdown: {
      keyword: keywordScore,
      sections: sectionScore,
      action_verbs: actionScore,
      quantification: quantScore,
      length: lengScore,
      formatting: fmtScore,
      alignment: alignmentScore,
    },
  };
}

/**
 * Generate suggested bullet rewrites by picking weak bullets from the resume
 * and producing improved variants. Used as a fallback when the AI doesn't
 * supply the field, or to backfill if the AI returns an empty array.
 */
export function generateLocalBulletRewrites(
  resumeText: string,
  jobDescription: string,
  max = 4
): Array<{ original: string; improved: string; reason: string; impact_score: number }> {
  const bullets = getBulletLines(resumeText);
  const jdKeywords = extractJDKeywords(jobDescription, 20);
  const weak: string[] = [];

  for (const b of bullets) {
    const cleanFirst = b.replace(/^[\-•▪◦*●·\d.)\s]+/, '').split(/\s+/)[0]?.toLowerCase() || '';
    const hasNumber = /\b\d+/.test(b);
    const hasAction = ACTION_VERBS.has(cleanFirst);
    if (!hasAction || !hasNumber) weak.push(b);
    if (weak.length >= max) break;
  }

  return weak.slice(0, max).map(original => {
    const cleaned = original.replace(/^[\-•▪◦*●·\d.)\s]+/, '');
    const verb = ['Architected', 'Engineered', 'Optimized', 'Delivered', 'Shipped'][Math.floor(Math.random() * 5)];
    const metric = ['by 30%', 'for 10K+ users', 'reducing latency by 40%', 'across 5 services'][Math.floor(Math.random() * 4)];
    const kwHint = jdKeywords[Math.floor(Math.random() * Math.min(5, jdKeywords.length))] || '';
    const improved = `${verb} ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}${kwHint ? ` leveraging ${kwHint}` : ''}, ${metric}.`;
    return {
      original,
      improved: improved.replace(/\s+/g, ' ').trim(),
      reason: 'Adds a strong action verb, quantifiable impact, and a relevant keyword from the job description.',
      impact_score: 7,
    };
  });
}
