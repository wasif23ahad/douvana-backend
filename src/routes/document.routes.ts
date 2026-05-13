import { Router } from 'express';
import { 
  createCoverLetter, 
  getCoverLetters, 
  deleteCoverLetter,
  createEmailDraft,
  getEmailDrafts,
  deleteEmailDraft
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/cover-letter', createCoverLetter);
router.get('/cover-letter', getCoverLetters);
router.delete('/cover-letter/:id', deleteCoverLetter);

router.post('/email-draft', createEmailDraft);
router.get('/email-draft', getEmailDrafts);
router.delete('/email-draft/:id', deleteEmailDraft);

export default router;
