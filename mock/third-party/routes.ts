import { Router } from 'express';
import { logRequest } from './longger';

const router = Router();

router.post('/orders', (req, res) => {
  logRequest('POST /orders', req.body);

  res.json({
    success: true,
    external_id: 'DUMMY-ORDER-001',
    received_at: new Date().toISOString()
  });
});

export default router;
