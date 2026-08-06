import mongoose from "mongoose";
import User from "@/models/User";

const MONGODB_URI = process.env.MONGODB_URI;

// 用 global 快取連線,避免 Next.js 每次請求(尤其是開發模式熱重載時)都重新連一次資料庫。
// 這是 Next.js + Mongoose 官方建議的標準寫法,對切頁速度影響很大。
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

const connectMongo = async () => {
  if (!MONGODB_URI) {
    throw new Error(
      "Add the MONGODB_URI environment variable inside .env.local to use mongoose"
    );
  }

  // 已經有現成的連線,直接重複使用,不用重新握手
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: true,
        maxPoolSize: 10,
      })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error("Mongoose Client Error: " + e.message);
    throw e;
  }

  return cached.conn;
};

export default connectMongo;
