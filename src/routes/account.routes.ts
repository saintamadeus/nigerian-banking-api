import { Router } from 'express';
import * as AccountController from '../controllers/account.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', AccountController.getUserAccounts);
router.post('/', AccountController.createAccount);
router.get('/:id', AccountController.getAccount);
router.post('/:id/transaction', AccountController.processTransaction);
router.get('/:id/transactions', AccountController.getTransactionHistory);

export default router;