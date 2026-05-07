import { Router } from 'express';
import { 
  analyzeJD, 
  generateResume, 
  getJobStatus, 
  generateCoverLetter, 
  calculateHealthScore 
} from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.post('/analyze-jd', analyzeJD);
router.post('/generate-resume', generateResume);
router.get('/jobs/:id', getJobStatus);
router.post('/generate-cover-letter', generateCoverLetter);
router.post('/health-score', calculateHealthScore);

export default router;
