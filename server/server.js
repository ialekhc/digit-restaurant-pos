import 'dotenv/config';
import { app } from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 5500;

const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
