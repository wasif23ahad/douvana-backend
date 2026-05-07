import OpenAI from 'openai';

export const nim = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_NIM_API_KEY!,
});

// Model constants — always import from here, never hardcode strings
export const NIM_MODELS = {
  ANALYZER:      'moonshotai/kimi-k2-thinking',
  RESUME:        'moonshotai/kimi-k2-thinking',
  HEALTH_SCORE:  'moonshotai/kimi-k2-thinking',
  COVER_LETTER:  'mistralai/devstral-2-123b-instruct-2512',
  EMAIL:         'stepfun-ai/step-3.5-flash',
  FALLBACK:      'deepseek-ai/deepseek-v3-2',
} as const;
