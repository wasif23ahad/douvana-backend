import { Router } from 'express';
import multer from 'multer';
import { 
  parseJD,
  analyzeResumeSSE,
  generateCoverLetterSSE,
  generateEmail,
  chatSSE,
  analyzePipelineHealth,
  parseResumePDF,
  generateResume,
  getJobStatus
} from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Agent 1: JD Parser
router.post('/parse-jd', parseJD);

// Agent 2: ATS Analyzer (SSE)
router.get('/analyze-resume/sse/:applicationId', analyzeResumeSSE);

// Agent 3: Cover Letter (SSE)
router.post('/generate-cover-letter/sse', generateCoverLetterSSE);

// Agent 4: Email Draft
router.post('/generate-email', generateEmail);

// Agent 5: Career Coach (SSE)
router.post('/chat/sse', chatSSE);

// Agent 6: Pipeline Health
router.get('/pipeline-health', analyzePipelineHealth);

// Resume Builder: PDF Parse
router.post('/parse-resume', upload.single('file'), parseResumePDF);

// Resume Builder: Generate ATS tailored resume
router.post('/generate-resume', generateResume);
router.get('/jobs/:jobId', getJobStatus);

export default router;
