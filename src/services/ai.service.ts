import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import logger from '../lib/logger.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export class AIService {
  /**
   * Analyze a Job Description
   */
  async analyzeJD(jd: string) {
    try {
      const prompt = `
        Analyze the following Job Description and extract key insights in JSON format.
        Return the following structure:
        {
          "requiredSkills": ["skill1", "skill2"],
          "niceToHave": ["skill1", "skill2"],
          "experienceLevel": "Junior/Mid/Senior",
          "atsKeywords": ["keyword1", "keyword2"],
          "cultureSignals": ["value1", "value2"],
          "redFlags": ["flag1"],
          "companySummary": "brief summary",
          "roleInsights": "what this role actually focuses on"
        }

        Job Description:
        ${jd}
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean potential markdown code blocks
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('AI analyzeJD Error:', error);
      throw error;
    }
  }

  /**
   * Generate Resume Content based on JD and User Profile
   */
  async generateResume(userData: any, jdAnalysis: any) {
    try {
      const prompt = `
        Create a professional, high-impact resume content tailored for this specific job.
        Targeting: ${jdAnalysis.roleInsights}
        Required Skills: ${jdAnalysis.requiredSkills.join(', ')}

        User Experience:
        ${JSON.stringify(userData.experience)}

        Return a JSON object matching this structure:
        {
          "summary": "Impactful professional summary",
          "experience": [
            {
              "role": "title",
              "company": "name",
              "duration": "dates",
              "achievements": ["bullet1 with metrics", "bullet2"]
            }
          ],
          "skills": ["tailored skill list"]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('AI generateResume Error:', error);
      throw error;
    }
  }

  /**
   * Generate Cover Letter (Streaming Support)
   */
  async generateCoverLetterStream(userData: any, applicationData: any) {
    try {
      const prompt = `
        Write a compelling, professional cover letter for ${userData.name} applying for the ${applicationData.jobTitle} position at ${applicationData.company}.
        Focus on these key skills: ${applicationData.jdAnalysis?.requiredSkills?.join(', ') || 'relevance'}.
        Keep it concise, bold, and personalized.
      `;

      const result = await model.generateContentStream(prompt);
      return result.stream;
    } catch (error) {
      logger.error('AI generateCoverLetter Error:', error);
      throw error;
    }
  }

  /**
   * Calculate Health Score / Match Percentage
   */
  async calculateHealthScore(resumeContent: any, jdAnalysis: any) {
    try {
      const prompt = `
        Compare the following resume content with the job requirements and calculate a match score.
        
        Resume: ${JSON.stringify(resumeContent)}
        Requirements: ${JSON.stringify(jdAnalysis)}

        Return a JSON:
        {
          "overallScore": 0-100,
          "atsProbability": 0-100,
          "keywordMatchScore": 0-100,
          "missingSkills": ["skill1"],
          "strengths": ["point1"],
          "recommendations": ["advice1"]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('AI calculateHealthScore Error:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
