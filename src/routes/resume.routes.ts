import { Router } from 'express';
import { getMasterResume, updateMasterResume } from '../controllers/resume.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/master', getMasterResume);
router.put('/master', updateMasterResume);

export default router;
