import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  await mongoose.connect(mongoURI);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};
