import { Router } from 'express';
import { 
  getMasterResume, 
  updateMasterResume,
  createResumeVersion,
  getResumeVersions,
  deleteResumeVersion
} from '../controllers/resume.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/master', getMasterResume);
router.put('/master', updateMasterResume);

router.post('/versions', createResumeVersion);
router.get('/versions', getResumeVersions);
router.delete('/versions/:id', deleteResumeVersion);

export default router;
