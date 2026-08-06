import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import GoogleProvider from "next-auth/providers/google"
import config from "@/config"
import connectMongo from "./mongo"

export const { handlers, auth, signIn, signOut } = NextAuth({

  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    // 只留 Google 登入,Email/Magic Link 選項拿掉了
    ...(connectMongo
      ? [
          GoogleProvider({
            // Follow the "Login with Google" tutorial to get your credentials
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
            authorization: {
              params: {
                // openid/email/profile 是登入用的原本權限
                // calendar.events 讓我們可以幫使用者建立/讀取行程,查衝突用的 calendar.readonly 已經包含在裡面
                scope:
                  "openid email profile https://www.googleapis.com/auth/calendar.events",
                // offline + consent 才拿得到 refresh_token,不然 access_token 一小時就過期
                access_type: "offline",
                prompt: "consent",
              },
            },
            async profile(profile) {
              return {
                id: profile.sub,
                name: profile.given_name ? profile.given_name : profile.name,
                email: profile.email,
                image: profile.picture,
                createdAt: new Date(),
              };
            },
          }),
        ]
      : []),
  ],

  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONGODB_URI env variable.
  // Learn more about the model type: https://authjs.dev/concepts/database-models
  ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  theme: {
    brandColor: config.colors.main,
    // 用本機/正式站都通用的相對路徑,不用依賴 config.domainName 是否已經正確設定
    logo: "/logo.png",
  },
});
