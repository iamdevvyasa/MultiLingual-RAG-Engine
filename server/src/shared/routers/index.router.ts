import express from 'express';
import healthRouter from './health.router.js';
import queryRouter from './query.router.js';
import documentRouter from './document.router.js';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/query', queryRouter);
router.use('/documents', documentRouter);

export default router;
