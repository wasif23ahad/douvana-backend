import { Router } from 'express';
import { getMasterResume, updateMasterResume } from '../controllers/resume.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/master', getMasterResume);
router.put('/master', updateMasterResume);

export default router;
