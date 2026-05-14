import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { prompts, buildATSAnalyzerPrompt, buildATSAnalyzerPromptFromText, buildCoverLetterPrompt } from './aiPrompts';
import { callAI, streamAI } from '../config/aiClient';
import { Response } from 'express';

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
   * Uses non-streaming callAI with jsonMode to guarantee clean JSON output.
   */
  async analyzeResumeSSE(resumeData: any, jobDescription: string, res: Response, userId: string) {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (type: string, payload: object) =>
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

    try {
      send('progress', { step: 1, message: 'Analyzing resume against job description...' });

      const prompt = (resumeData as any)?.rawText
        ? buildATSAnalyzerPromptFromText((resumeData as any).rawText, jobDescription)
        : buildATSAnalyzerPrompt(resumeData, jobDescription);

      send('progress', { step: 2, message: 'Running ATS compatibility check...' });

      const raw = await callAI({
        system: prompts.ATS_ANALYZER_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000,
        jsonMode: true,
      });

      if (!raw) throw new Error('AI returned empty response');

      // Strip markdown code fences if present (some models wrap JSON in ```json ... ```)
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      // Extract the JSON object in case there's any leading/trailing prose
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI response did not contain valid JSON');

      const result = JSON.parse(match[0]);

      send('complete', { result });
      res.end();

      await this.logAIUsage({
        userId,
        feature: 'ATS_ANALYZER',
        latencyMs: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      logger.error('ATS Analyzer Agent Error:', error.message);
      send('error', { message: 'Analysis failed: ' + (error.message || 'Unknown error') });
      res.end();

      await this.logAIUsage({
        userId,
        feature: 'ATS_ANALYZER',
        latencyMs: Date.now() - startTime,
        success: false,
        errorMsg: error.message,
      });
    }
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

    try {
      const systemPrompt = prompts.CHAT_SYSTEM(context);
      const stream = await streamAI({
        system: systemPrompt,
        messages: history,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ type: 'delta', content })}\n\n`);
        }
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
      logger.error('Career Coach Agent Error:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'AI Service Gateway unavailable' })}\n\n`);
      res.end();
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
