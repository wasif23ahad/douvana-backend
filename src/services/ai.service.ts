import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { prompts, buildATSAnalyzerPrompt, buildATSAnalyzerPromptFromText, buildCoverLetterPrompt } from './aiPrompts';
import { callAI, streamAI } from '../config/aiClient';
import { Response } from 'express';
import { scoreResumeAgainstJD, generateLocalBulletRewrites, ATSScoringResult } from '../lib/atsScorer';

// Career-coach scope guard. Returns true when the user's message is clearly outside
// the coach's domain (career / interview / resume / tech-interview / job-search).
// Tuned to catch the common off-topic asks without false-positive on technical
// interview questions (Node, algorithms, system design, etc.).
function isOffTopic(message: string): boolean {
  const text = message.toLowerCase().trim();
  if (!text) return false;

  // Always allow obvious in-scope vocabulary — this prevents false positives.
  // The scope is intentionally broad: anything tech OR anything career.
  const inScopeSignals = [
    // career / job-search
    'resume', 'cv', 'cover letter', 'interview', 'recruiter', 'hiring', 'hire',
    'job', 'jobs', 'role', 'position', 'application', 'apply', 'applied',
    'career', 'salary', 'compensation', 'offer', 'negotiat', 'linkedin', 'portfolio',
    'referral', 'follow-up', 'follow up', 'rejection', 'onsite', 'screening',
    'mock interview', 'big tech', 'faang', 'recruit', 'company', 'startup',
    'behavioral', 'star method', 'star answer', 'technical question',
    // problem solving / DSA / competitive programming
    'coding', 'code', 'codes', 'algorithm', 'algo', 'dsa', 'data structure',
    'problem solving', 'problem-solving', 'practice problem', 'coding problem',
    'leetcode', 'neetcode', 'hackerrank', 'codeforces', 'atcoder', 'codechef',
    'codewars', 'topcoder', 'cses', 'interviewbit', 'algoexpert', 'educative',
    'grokking', 'bytebytego', 'system design primer', 'cracking the coding',
    'big o', 'time complexity', 'space complexity', 'dynamic programming',
    'recursion', 'backtracking', 'greedy', 'sliding window', 'two pointer',
    'binary search', 'graph', 'tree', 'linked list', 'hash map', 'hashmap',
    'stack', 'queue', 'heap', 'trie', 'bfs', 'dfs', 'dijkstra', 'topological',
    // languages
    'javascript', 'typescript', 'python', 'java ', 'kotlin', 'swift', 'golang',
    ' go ', 'rust', 'c++', 'c#', 'php', 'ruby', 'scala', 'dart', 'r ', 'matlab',
    'haskell', 'elixir', 'clojure', 'perl', 'bash', 'shell',
    // frontend
    'react', 'next.js', 'nextjs', 'vue', 'svelte', 'angular', 'remix',
    'tailwind', 'css', 'html', 'sass', 'webpack', 'vite', 'redux', 'zustand',
    'storybook', 'figma', 'a11y', 'accessibility', 'web vitals',
    // backend
    'node', 'express', 'nestjs', 'fastify', 'django', 'fastapi', 'flask',
    'spring', 'rails', 'laravel', '.net', 'asp.net',
    // databases
    'sql', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mariadb',
    'mongo', 'mongodb', 'redis', 'dynamodb', 'cassandra', 'elasticsearch',
    'prisma', 'sequelize', 'orm', 'index', 'query',
    // cloud / devops / infra
    'docker', 'kubernetes', 'k8s', 'helm', 'terraform', 'ansible',
    'aws', 'gcp', 'azure', 'lambda', 's3', 'ec2', 'cloudflare', 'vercel',
    'netlify', 'heroku', 'ci/cd', 'github actions', 'gitlab', 'jenkins',
    'monitoring', 'observability', 'prometheus', 'grafana', 'sentry',
    'devops', 'sre', 'platform engineering',
    // networking / security / OS
    'http', 'https', 'tcp', 'udp', 'dns', 'tls', 'ssl', 'cors', 'csrf', 'xss',
    'oauth', 'jwt', 'authentication', 'authorization', 'encryption', 'hashing',
    'linux', 'unix', 'kernel', 'process', 'thread', 'concurrency', 'mutex',
    'operating system', 'memory leak',
    // data / ml / ai
    'machine learning', 'ml ', 'deep learning', 'neural network', 'llm',
    'transformer', 'embedding', 'vector db', 'rag', 'fine-tune', 'tensorflow',
    'pytorch', 'numpy', 'pandas', 'jupyter', 'data engineering', 'etl', 'spark',
    'kafka', 'airflow', 'snowflake', 'bigquery', 'data warehouse',
    // architecture / system design
    'system design', 'microservice', 'monolith', 'event-driven', 'cqrs',
    'pub/sub', 'pubsub', 'message queue', 'load balancer', 'scalab',
    'distributed', 'sharding', 'replication', 'consistency', 'cap theorem',
    'caching', 'cache', 'cdn', 'rate limit', 'throttle',
    // protocols / formats
    'graphql', 'rest', 'grpc', 'websocket', 'sse ', 'server-sent', 'json',
    'yaml', 'protobuf', 'xml',
    // roles
    'frontend', 'backend', 'full-stack', 'fullstack', 'mobile dev', 'android dev',
    'ios dev', 'ml engineer', 'ai engineer', 'data engineer', 'data scientist',
    'qa engineer', 'software engineer', 'developer', 'programmer', 'engineer',
    'engineering manager', 'tech lead', 'principal engineer', 'staff engineer',
    'pm role', 'product manager', 'designer role', 'ux ', 'ui ', 'ats',
    // generic tech / curiosity prompts
    'tech', 'technology', 'programming', 'software', 'web dev', 'app dev',
    'debug', 'debugging', 'refactor', 'unit test', 'integration test',
    'pull request', 'pr review', 'code review', 'git ',
    'how does', 'what is the difference', 'explain', 'best practice',
    // skill-building / learning
    'learn ', 'learning path', 'study plan', 'roadmap', 'prepare', 'preparation',
    'skill', 'tutorial', 'course',
  ];
  if (inScopeSignals.some(s => text.includes(s))) return false;

  // Hard off-topic categories — refuse fast.
  const offTopicSignals = [
    // food / lifestyle
    'recipe', 'cook ', 'cooking', 'bake ', 'baking', 'restaurant', 'pizza', 'biryani',
    // entertainment
    'movie', 'film ', 'netflix', 'tv show', 'tv series', 'anime', 'manga', 'song ',
    'lyric', 'music ', 'album', 'concert', 'celebrity', 'gossip', 'joke ', 'meme',
    'video game', 'gaming', 'fortnite', 'minecraft', 'pokemon',
    // sports
    'football', 'soccer', 'cricket', 'basketball', 'tennis', 'fifa', 'nba ', 'ipl ',
    'world cup', 'premier league', 'olympics', 'messi', 'ronaldo',
    // relationships / personal
    'girlfriend', 'boyfriend', 'dating', 'crush', 'breakup', 'marry', 'marriage',
    'relationship advice', 'love advice', 'romantic',
    // sensitive non-career
    'medical advice', 'diagnose', 'symptom', 'medicine', 'prescription', 'illness',
    'legal advice', 'lawsuit', 'lawyer', 'attorney',
    'financial advice', 'invest in stocks', 'crypto trade', 'forex',
    // general trivia / weather / news
    'weather', 'tomorrow forecast', 'temperature today', 'horoscope', 'astrology',
    'religion', 'politic', 'election', 'president of ', 'prime minister of ',
    // chit-chat / misc
    'tell me a joke', 'tell me a story', 'write a poem', 'write a story',
    'fortune teller', 'tarot', 'meaning of life',
  ];
  if (offTopicSignals.some(s => text.includes(s))) return true;

  // Very short pure greetings are fine — let the AI greet back.
  if (/^(hi|hello|hey|yo|hiya|sup|good (morning|afternoon|evening))[!.\s]*$/i.test(text)) {
    return false;
  }

  return false;
}

function buildScopeRefusal(): string {
  return (
    "That's outside what I'm built for — I'm your **Drouvana Career Coach**, focused on **tech topics** and **career growth**.\n\n" +
    "Here are a few things I can help you with instead:\n" +
    "- Answer a tech question (languages, frameworks, system design, databases, DevOps, AI/ML)\n" +
    "- Walk through a coding problem and recommend where to practice (LeetCode, NeetCode, Codeforces, etc.)\n" +
    "- Review or rewrite a resume bullet, summary, or cover letter\n" +
    "- Plan a study roadmap for your target role (DSA, system design, a new stack)\n" +
    "- Draft a recruiter outreach or follow-up message\n" +
    "- Strategize your job search or salary negotiation\n\n" +
    "What would you like to work on?"
  );
}

export class AIService {
  /**
   * Agent 1: JD Parser
   * Extracts structured data from raw job descriptions.
   */
  async parseJD(jd: string, userId?: string) {
    const startTime = Date.now();
    try {
      const response = await callAI({
        system: prompts.JD_PARSER_SYSTEM,
        messages: [{ role: 'user', content: jd }],
        temperature: 0.1,
        jsonMode: true,
      });

      const parsedData = JSON.parse(response || '{}');
      
      await this.logAIUsage({
        userId,
        feature: 'JD_PARSER',
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return parsedData;
    } catch (error: any) {
      logger.error('JD Parser Agent Error:', error.message);
      await this.logAIUsage({
        userId,
        feature: 'JD_PARSER',
        latencyMs: Date.now() - startTime,
        success: false,
        errorMsg: error.message,
      });
      throw error;
    }
  }

  /**
   * Agent 2: ATS Analyzer
   *
   * Architecture:
   *   1. Run a deterministic local scorer FIRST — guarantees the user always sees
   *      a real, explainable score even if the AI fails or returns garbage.
   *   2. Call the LLM with a strict scoring rubric and JSON schema.
   *   3. Merge: AI fills in narrative fields (rewrites, summary, suggestions);
   *      local fills in or floors any missing/zero numeric fields.
   *   4. If the AI omits bullet rewrites, generate plausible local ones from
   *      the actual weakest bullets in the resume.
   */
  async analyzeResumeSSE(
    resumeData: any,
    jobDescription: string,
    res: Response,
    userId: string,
    extras: { jobTitle?: string; companyName?: string } = {}
  ) {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (type: string, payload: object) =>
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

    // Normalize resume to plain text for both the local scorer and the prompt
    const resumeText: string = typeof resumeData === 'string'
      ? resumeData
      : (resumeData as any)?.rawText
      ? String((resumeData as any).rawText)
      : this.flattenResumeData(resumeData);

    if (!resumeText.trim() || !jobDescription.trim()) {
      send('error', { message: 'Resume content and job description are both required.' });
      res.end();
      return;
    }

    // 1. Local deterministic baseline — runs in <50ms, never throws
    send('progress', { step: 1, message: 'Parsing resume structure...' });
    let local: ATSScoringResult;
    try {
      local = scoreResumeAgainstJD(resumeText, jobDescription, extras.jobTitle);
    } catch (err: any) {
      logger.error('Local ATS scorer crashed:', err.message);
      // Even if the scorer crashes, ship a minimal valid shape so the UI works
      local = {
        ats_score: 50,
        keyword_match_rate: 0.5,
        present_keywords: [],
        missing_keywords: [],
        section_scores: { summary: 50, experience: 50, skills: 50, education: 50 },
        strengths: ['Resume received and parsed.'],
        overall_suggestions: ['Add a clear summary, quantified bullets, and JD-specific keywords.'],
        breakdown: { keyword: 50, sections: 50, action_verbs: 50, quantification: 50, length: 50, formatting: 50, alignment: 50 },
      };
    }

    send('progress', { step: 2, message: 'Matching against job description keywords...' });

    // 2. AI call (best-effort; failures fall back to local-only)
    let aiResult: any = null;
    try {
      const prompt = buildATSAnalyzerPromptFromText(
        resumeText,
        jobDescription,
        extras.jobTitle,
        extras.companyName
      );

      send('progress', { step: 3, message: 'Running AI compatibility analysis...' });

      const raw = await callAI({
        system: prompts.ATS_ANALYZER_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 3000,
        jsonMode: true,
      });

      aiResult = this.extractJson(raw);
    } catch (error: any) {
      logger.warn('ATS AI call failed, using local scorer only:', error.message);
    }

    send('progress', { step: 4, message: 'Generating tailored recommendations...' });

    // 3. Merge — local provides numeric floor; AI provides narrative quality
    const merged = this.mergeATSResults(local, aiResult, resumeText, jobDescription);

    // 4. Final guard — ats_score must be a sensible non-zero number
    if (!merged.ats_score || merged.ats_score < 15 || isNaN(merged.ats_score)) {
      merged.ats_score = local.ats_score;
    }

    send('complete', { result: merged });
    res.end();

    await this.logAIUsage({
      userId,
      feature: 'ATS_ANALYZER',
      latencyMs: Date.now() - startTime,
      success: true,
    });
  }

  /**
   * Flatten a structured master-resume JSON into a single text blob the scorer can consume.
   */
  private flattenResumeData(data: any): string {
    if (!data || typeof data !== 'object') return '';
    const parts: string[] = [];
    const p = data.personalInfo || {};
    if (p.name) parts.push(p.name);
    if (p.email) parts.push(p.email);
    if (data.summary) parts.push(`SUMMARY\n${data.summary}`);
    if (Array.isArray(data.experience)) {
      parts.push('EXPERIENCE');
      for (const e of data.experience) {
        parts.push(`${e.role || ''} at ${e.company || ''} (${e.dates || ''})`);
        if (e.description) parts.push(e.description);
      }
    }
    if (Array.isArray(data.education)) {
      parts.push('EDUCATION');
      for (const e of data.education) {
        parts.push(`${e.degree || ''} - ${e.institution || ''} (${e.endDate || ''})`);
      }
    }
    if (data.skills) {
      parts.push('SKILLS');
      parts.push(typeof data.skills === 'string' ? data.skills : JSON.stringify(data.skills));
    }
    if (Array.isArray(data.projects)) {
      parts.push('PROJECTS');
      for (const proj of data.projects) parts.push(`${proj.name || ''}: ${proj.description || ''}`);
    }
    return parts.join('\n');
  }

  /**
   * Robust JSON extraction from arbitrary LLM output. Handles:
   *   • clean JSON
   *   • code-fenced JSON (```json ... ```)
   *   • prose with an embedded JSON object
   *   • truncated JSON (returns best-effort partial)
   */
  private extractJson(raw: string | null | undefined): any | null {
    if (!raw) return null;
    let text = String(raw).trim();
    // Strip code fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Direct parse
    try { return JSON.parse(text); } catch { /* try harder */ }

    // Find first { ... last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(candidate); } catch { /* try cleanup */ }

      // Common cleanup: trailing commas, unescaped newlines inside strings
      const cleaned = candidate
        .replace(/,(\s*[}\]])/g, '$1')           // trailing commas
        .replace(/[ -]+/g, ' ')        // control chars
        .replace(/}\s*{/g, '},{');                 // run-on objects
      try { return JSON.parse(cleaned); } catch { /* give up */ }
    }
    return null;
  }

  /**
   * Merge an LLM-returned ATS result with the local deterministic baseline.
   * Local provides safe defaults and a numeric floor; AI provides richer narrative.
   */
  private mergeATSResults(
    local: ATSScoringResult,
    ai: any,
    resumeText: string,
    jobDescription: string
  ): any {
    const safe = (n: any, fallback: number): number => {
      const v = Number(n);
      return Number.isFinite(v) && v > 0 ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
    };

    if (!ai || typeof ai !== 'object') {
      // AI failed entirely — use local plus generated rewrites
      return {
        ...local,
        suggested_summary: this.buildLocalSummary(resumeText, local.present_keywords),
        suggested_bullet_rewrites: generateLocalBulletRewrites(resumeText, jobDescription),
      };
    }

    // AI returned something — sanitize & merge
    const aiScore = safe(ai.ats_score, local.ats_score);
    // Take the higher of the two scores so the user sees the most generous accurate view,
    // but never lower than the local baseline (prevents AI returning 0).
    const finalScore = Math.max(aiScore, local.ats_score);

    const aiPresent: string[] = Array.isArray(ai.present_keywords) ? ai.present_keywords : [];
    const aiMissing: string[] = Array.isArray(ai.missing_keywords) ? ai.missing_keywords : [];
    const presentKeywords = aiPresent.length >= 3 ? aiPresent : local.present_keywords;
    const missingKeywords = aiMissing.length >= 3 ? aiMissing : local.missing_keywords;

    const matchRate = (() => {
      const rate = Number(ai.keyword_match_rate);
      if (Number.isFinite(rate) && rate > 0 && rate <= 1) return rate;
      const total = presentKeywords.length + missingKeywords.length;
      return total ? presentKeywords.length / total : local.keyword_match_rate;
    })();

    const aiSections = ai.section_scores || {};
    const sectionScores = {
      summary: safe(aiSections.summary, local.section_scores.summary),
      experience: safe(aiSections.experience, local.section_scores.experience),
      skills: safe(aiSections.skills, local.section_scores.skills),
      education: safe(aiSections.education, local.section_scores.education),
    };

    let rewrites = Array.isArray(ai.suggested_bullet_rewrites)
      ? ai.suggested_bullet_rewrites
          .filter((r: any) => r && typeof r.original === 'string' && typeof r.improved === 'string')
          .map((r: any) => ({
            original: String(r.original).slice(0, 500),
            improved: String(r.improved).slice(0, 500),
            reason: String(r.reason || '').slice(0, 300),
            impact_score: Math.min(10, Math.max(1, Number(r.impact_score) || 7)),
          }))
      : [];
    if (rewrites.length === 0) {
      rewrites = generateLocalBulletRewrites(resumeText, jobDescription);
    }

    const suggestedSummary = typeof ai.suggested_summary === 'string' && ai.suggested_summary.length > 30
      ? ai.suggested_summary
      : this.buildLocalSummary(resumeText, presentKeywords);

    const strengths = Array.isArray(ai.strengths) && ai.strengths.length
      ? ai.strengths.map((s: any) => String(s)).slice(0, 6)
      : local.strengths;

    const overallSuggestions = Array.isArray(ai.overall_suggestions) && ai.overall_suggestions.length
      ? ai.overall_suggestions.map((s: any) => String(s)).slice(0, 8)
      : local.overall_suggestions;

    return {
      ats_score: finalScore,
      keyword_match_rate: Math.round(matchRate * 100) / 100,
      present_keywords: presentKeywords,
      missing_keywords: missingKeywords,
      suggested_summary: suggestedSummary,
      suggested_bullet_rewrites: rewrites,
      section_scores: sectionScores,
      strengths,
      overall_suggestions: overallSuggestions,
      breakdown: local.breakdown,
    };
  }

  /**
   * Build a tailored summary purely from the resume + matched keywords (no AI).
   * Used when the AI response is missing or unusable.
   */
  private buildLocalSummary(resumeText: string, presentKeywords: string[]): string {
    const yearsMatch = resumeText.match(/(\d+)\+?\s*(years?|yrs?)\s*(of\s*)?experience/i);
    const years = yearsMatch ? `${yearsMatch[1]}+ years of` : 'Hands-on';
    const topKeywords = presentKeywords.slice(0, 5).join(', ');
    return `${years} engineering experience with proven impact across ${topKeywords || 'modern web technologies'}. Skilled in shipping production systems, optimizing performance, and collaborating across cross-functional teams to deliver measurable business results.`;
  }

  /**
   * Agent 3: Cover Letter (Streaming)
   */
  async generateCoverLetterSSE(params: any, res: Response, userId: string) {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'text/event-stream');
    
    try {
      const prompt = buildCoverLetterPrompt(params);
      const stream = await streamAI({
        system: prompts.COVER_LETTER_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        res.write(`data: ${JSON.stringify({ type: 'delta', content })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', fullContent })}\n\n`);
      res.end();

      await this.logAIUsage({
        userId,
        feature: 'COVER_LETTER',
        latencyMs: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      logger.error('Cover Letter Agent Error:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Agent 4: Email Drafting
   */
  async generateEmail(params: any, userId: string) {
    const startTime = Date.now();
    try {
      const response = await callAI({
        system: prompts.EMAIL_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(params) }],
        jsonMode: true,
      });

      const emailData = JSON.parse(response || '{}');
      await this.logAIUsage({
        userId,
        feature: 'EMAIL_DRAFT',
        latencyMs: Date.now() - startTime,
        success: true,
      });
      return emailData;
    } catch (error: any) {
      logger.error('Email Agent Error:', error.message);
      throw error;
    }
  }

  /**
   * Agent 5: Career Coach (Multi-turn)
   */
  async chatSSE(history: any[], context: any, res: Response, userId: string) {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeDelta = (content: string) =>
      res.write(`data: ${JSON.stringify({ type: 'delta', content })}\n\n`);

    const latestUserMsg = [...(history || [])].reverse().find((m: any) => m?.role === 'user')?.content || '';

    // Fast-path: deterministic scope guard. If the user's latest message is clearly
    // off-topic, refuse without spending an AI call. This guarantees the scope
    // policy holds even when the upstream LLM ignores instructions.
    if (typeof latestUserMsg === 'string' && isOffTopic(latestUserMsg)) {
      const refusal = buildScopeRefusal();
      for (const word of refusal.split(' ')) {
        writeDelta(word + ' ');
        await new Promise(r => setTimeout(r, 8));
      }
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      await this.logAIUsage({
        userId,
        feature: 'CAREER_COACH',
        latencyMs: Date.now() - startTime,
        success: true,
      });
      return;
    }

    let systemPrompt: string;
    try {
      systemPrompt = prompts.CHAT_SYSTEM(context || {});
    } catch (promptErr: any) {
      logger.error('Career Coach prompt build failed:', promptErr?.message);
      systemPrompt = prompts.CHAT_SYSTEM({});
    }

    // Sanitize history: only user/assistant turns with string content.
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-20);

    // Most LLMs expect the conversation to start with a user turn after the system prompt.
    // Drop a leading assistant message (the canned greeting) if present.
    while (safeHistory.length > 0 && safeHistory[0].role === 'assistant') {
      safeHistory.shift();
    }

    if (safeHistory.length === 0) {
      // Nothing meaningful to answer.
      writeDelta('Could you share a bit more about what you need help with? I can help with interview prep, resume work, technical interview questions, or job-search strategy.');
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      return;
    }

    try {
      const stream = await streamAI({
        system: systemPrompt,
        messages: safeHistory,
        temperature: 0.6,
        max_tokens: 1200,
      });

      let streamed = 0;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          writeDelta(content);
          streamed += content.length;
        }
      }

      // Safety net: if the upstream produced nothing, send a graceful fallback
      // instead of an empty bubble.
      if (streamed === 0) {
        const fallback = "I'm having trouble reaching the AI right now. Could you try rephrasing your question, or pick one of the suggested prompts to get started?";
        for (const word of fallback.split(' ')) writeDelta(word + ' ');
      }

      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      await this.logAIUsage({
        userId,
        feature: 'CAREER_COACH',
        latencyMs: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      logger.error('Career Coach Agent Error:', error?.message);
      const fallback = "I hit a problem reaching the AI service. Please try again in a moment — and remember, I'm here for interview prep, resume help, technical questions, and job-search strategy.";
      for (const word of fallback.split(' ')) writeDelta(word + ' ');
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      await this.logAIUsage({
        userId,
        feature: 'CAREER_COACH',
        latencyMs: Date.now() - startTime,
        success: false,
        errorMsg: error?.message,
      });
    }
  }

  /**
   * Agent: Resume Generation
   * Tailors a resume based on JD and master resume
   */
  async generateResume(user: any, jdAnalysis: any) {
    const startTime = Date.now();
    try {
      const prompt = `
        JOB TITLE: ${jdAnalysis.roleInsights || 'Target Role'}
        REQUIRED SKILLS: ${jdAnalysis.requiredSkills?.join(', ')}
        KEY ARCHITECTURAL/TECH FOCUS: ${jdAnalysis.atsKeywords?.join(', ')}
        
        USER PROFILE:
        ${JSON.stringify(user)}
      `;

      const response = await callAI({
        system: prompts.RESUME_GEN_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        jsonMode: true,
      });

      const resumeContent = JSON.parse(response || '{}');
      
      await this.logAIUsage({
        userId: user.id,
        feature: 'RESUME_GEN',
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return resumeContent;
    } catch (error: any) {
      logger.error('Resume Generation Error:', error.message);
      throw error;
    }
  }

  /**
   * Agent: Resume PDF Parser
   */
  async parseResumeData(text: string, userId?: string) {
    const startTime = Date.now();
    try {
      const response = await callAI({
        system: prompts.RESUME_PARSER_SYSTEM || 'You are an AI resume parser. Extract the following JSON structure from the provided text: { personalInfo: { name, email, phone, linkedin }, summary: "", experience: [{ id, company, role, dates, description }], skills: "comma separated string" }. Only return the raw JSON object.',
        messages: [{ role: 'user', content: text }],
        temperature: 0.1,
        jsonMode: true,
      });

      const parsedData = JSON.parse(response || '{}');
      
      await this.logAIUsage({
        userId,
        feature: 'RESUME_PARSER',
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return parsedData;
    } catch (error: any) {
      logger.error('Resume Parser Agent Error:', error.message);
      await this.logAIUsage({
        userId,
        feature: 'RESUME_PARSER',
        latencyMs: Date.now() - startTime,
        success: false,
        errorMsg: error.message,
      });
      throw error;
    }
  }

  /**
   * Agent 6: Pipeline Health
   */
  async analyzePipelineHealth(stats: any, userId: string) {
    const startTime = Date.now();
    try {
      const response = await callAI({
        system: prompts.PIPELINE_HEALTH_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
        jsonMode: true,
      });

      const healthData = JSON.parse(response || '{}');
      await this.logAIUsage({
        userId,
        feature: 'PIPELINE_HEALTH',
        latencyMs: Date.now() - startTime,
        success: true,
      });
      return healthData;
    } catch (error: any) {
      logger.error('Pipeline Health Agent Error:', error.message);
      throw error;
    }
  }

  /**
   * Agent: General Text Enhancement (Summary / Bullets)
   */
  async enhanceText(text: string, type: string, userId?: string) {
    const startTime = Date.now();
    try {
      const systemPrompt = type === 'summary'
        ? 'You are an expert technical resume writer. Rewrite the provided professional summary to be highly compelling, concise, impactful, and ATS-optimized using rich engineering vocabulary. Return ONLY the polished plain text without any introductory remarks, formatting wrappers, or quotes.'
        : 'You are an expert technical resume writer. Rewrite the provided work experience bullet points or intelligence logs to be highly quantified, metrics-driven, begin with strong action verbs, and clearly demonstrate technical complexity and outcomes. Return ONLY the polished plain text without any introductory remarks, formatting wrappers, or quotes.';

      const response = await callAI({
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
        temperature: 0.3,
        jsonMode: false,
      });

      const enhancedText = response?.replace(/^["'\n]+|["'\n]+$/g, '').trim() || text;

      await this.logAIUsage({
        userId,
        feature: type === 'summary' ? 'ENHANCE_SUMMARY' : 'ENHANCE_BULLETS',
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return enhancedText;
    } catch (error: any) {
      logger.error('Enhance Text Agent Error:', error.message);
      await this.logAIUsage({
        userId,
        feature: type === 'summary' ? 'ENHANCE_SUMMARY' : 'ENHANCE_BULLETS',
        latencyMs: Date.now() - startTime,
        success: false,
        errorMsg: error.message,
      });
      throw error;
    }
  }

  /**
   * Helper: Log AI usage to database
   */
  private async logAIUsage(params: {
    userId?: string;
    feature: string;
    latencyMs: number;
    success: boolean;
    errorMsg?: string;
  }) {
    try {
      await prisma.aILog.create({
        data: {
          userId: params.userId,
          feature: params.feature,
          latencyMs: params.latencyMs,
          success: params.success,
          errorMsg: params.errorMsg,
        },
      });
    } catch (error) {
      logger.error('Failed to log AI usage to DB:', error);
    }
  }
}

export const aiService = new AIService();
