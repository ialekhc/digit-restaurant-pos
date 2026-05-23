import dotenv from "dotenv"
dotenv.config()

export const EnvExt = {
    PORT: process.env.PORT,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_URL: process.env.CLIENT_URL,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
}