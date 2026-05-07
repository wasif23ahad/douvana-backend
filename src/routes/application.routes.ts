import { Router } from 'express';
import { 
  getApplications, 
  createApplication, 
  getApplicationById, 
  updateApplication, 
  updateApplicationStatus, 
  deleteApplication,
  getActivities
} from '../controllers/application.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getApplications)
  .post(createApplication);

router.route('/:id')
  .get(getApplicationById)
  .put(updateApplication)
  .delete(deleteApplication);

router.patch('/:id/status', updateApplicationStatus);
router.get('/:id/activities', getActivities);

export default router;
