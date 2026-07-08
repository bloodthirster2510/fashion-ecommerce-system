import { Router } from 'express';
import { optionalAuthenticate } from '../../middlewares/auth.middleware';
import { createInteraction } from './interaction.controller';

const router = Router();

router.post('/', optionalAuthenticate, createInteraction);

export default router;
