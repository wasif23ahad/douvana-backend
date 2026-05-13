import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';
import logger from '../lib/logger';

// NVIDIA NIM (OpenAI Compatible)
export const nvidiaNim = new OpenAI({
  apiKey: env.NVIDIA_NIM_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

// Google Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Unified AI Call with Fallback
 */
export async function callAI(params: {
  messages: any[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
  jsonMode?: boolean;
}) {
  try {
    // 1. Try NVIDIA NIM (Llama 3.1 405b or similar)
    const response = await nvidiaNim.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: params.system 
        ? [{ role: 'system', content: params.system }, ...params.messages]
        : params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 2000,
      response_format: params.jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0].message.content;
  } catch (error: any) {
    logger.warn('NVIDIA NIM failed, falling back to Gemini:', error.message);

    // 2. Fallback to Gemini 1.5 Flash
    try {
      const prompt = params.system 
        ? `SYSTEM: ${params.system}\n\n${params.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}`
        : params.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      
      return params.jsonMode ? text.replace(/```json|```/g, '').trim() : text;
    } catch (geminiError: any) {
      logger.error('AI Fallback (Gemini) also failed:', geminiError.message);
      throw new Error('AI Services unavailable');
    }
  }
}

/**
 * Streaming Support for NVIDIA NIM
 */
export async function* streamAI(params: {
  messages: any[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
}) {
  try {
    const stream = await nvidiaNim.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: params.system 
        ? [{ role: 'system', content: params.system }, ...params.messages]
        : params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error: any) {
    logger.warn('NVIDIA NIM streaming failed, falling back to Gemini stream:', error.message);

    try {
      const prompt = params.system 
        ? `SYSTEM: ${params.system}\n\n${params.messages.map(m => `${m.role?.toUpperCase() || 'USER'}: ${m.content}`).join('\n')}`
        : params.messages.map(m => `${m.role?.toUpperCase() || 'USER'}: ${m.content}`).join('\n');

      const result = await geminiModel.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { choices: [{ delta: { content: text } }] } as any;
        }
      }
    } catch (geminiErr: any) {
      logger.error('Gemini fallback stream also failed:', geminiErr.message);
      yield { choices: [{ delta: { content: "\n[System Notice: All AI backend interfaces are currently at peak capacity. Please try again in a few moments.]" } }] } as any;
    }
  }
}
