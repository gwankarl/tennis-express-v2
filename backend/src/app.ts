import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

const app = express();

app.use(express.json());

// Basic endpoint to confirm that the HTTP application is responding.
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

// Register feature routes before the not-found and error handlers.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
