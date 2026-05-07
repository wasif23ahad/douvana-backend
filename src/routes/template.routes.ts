import { Router } from 'express';
import { getTemplates, getTemplateById } from '../controllers/template.controller';

const router = Router();

router.get('/', getTemplates);
router.get('/:id', getTemplateById);

export default router;
