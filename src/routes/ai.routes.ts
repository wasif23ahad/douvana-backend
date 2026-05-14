import { Router } from 'express';
import multer from 'multer';
import {
  parseJD,
  analyzeResumeSSE,
  analyzeResumeDirect,
  generateCoverLetterSSE,
  generateCoverLetterDirect,
  generateEmail,
  chatSSE,
  analyzePipelineHealth,
  parseResumePDF,
  generateResume,
  getJobStatus,
  getChatSessions,
  getChatMessages,
  createChatSession,
  deleteChatSession,
  enhanceText
} from '../controllers/ai.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Agent 1: JD Parser
router.post('/parse-jd', parseJD);

// Agent 2: ATS Analyzer (SSE)
router.get('/analyze-resume/sse/:applicationId', analyzeResumeSSE);
router.post('/analyze-resume/direct', analyzeResumeDirect);

// Agent 3: Cover Letter (SSE)
router.post('/generate-cover-letter/sse', generateCoverLetterSSE);
router.post('/generate-cover-letter/direct', generateCoverLetterDirect);

// Agent 4: Email Draft
router.post('/generate-email', generateEmail);
router.post('/enhance-text', enhanceText);

// Agent 5: Career Coach (SSE)
router.post('/chat/sse', chatSSE);

// Agent 6: Pipeline Health
router.get('/pipeline-health', analyzePipelineHealth);

// Resume Builder: PDF Parse
router.post('/parse-resume', upload.single('file'), parseResumePDF);

// Resume Builder: Generate ATS tailored resume
router.post('/generate-resume', generateResume);
router.get('/jobs/:jobId', getJobStatus);

// Chat Session Management
router.post('/chat/sessions', createChatSession);
router.get('/chat/sessions', getChatSessions);
router.get('/chat/sessions/:id/messages', getChatMessages);
router.delete('/chat/sessions/:id', deleteChatSession);

export default router;
