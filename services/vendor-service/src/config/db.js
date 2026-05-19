import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is required for vendor-service');
  }

  await mongoose.connect(mongoURI);
  console.log(`[vendor-service] MongoDB connected: ${mongoose.connection.host}`);
};
