import { Router } from 'express';

const v1Router = Router();

v1Router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

export default v1Router;
