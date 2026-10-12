import app from './app.js';
import { env } from './config/env.js';

// Start the HTTP server using the validated application configuration.
app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
