// libs/auth.js
import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import GoogleProvider from "next-auth/providers/google"
import config from "@/config"
import connectMongo from "./mongo"

// 包一層,讓 linkAccount 在帳號已存在時改成"更新 token",
// 而不是 NextAuth 預設的"直接跳過"。
// 這樣以後不管誰改 scope,舊使用者只要重新走一次登入(prompt=consent)
// 就能自動拿到新權限,不用手動去資料庫刪紀錄。
function patchedAdapter(baseAdapter) {
  return {
    ...baseAdapter,
    async linkAccount(account) {
      const db = (await connectMongo).connection?.db // 依你實際 connectMongo 回傳型態調整
      const existing = await baseAdapter.getAccount?.(
        account.providerAccountId,
        account.provider
      )

      if (!existing) {
        return baseAdapter.linkAccount(account)
      }

      // 帳號已存在,改成 upsert 更新 token/scope
      await db.collection("accounts").updateOne(
        {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
        {
          $set: {
            access_token: account.access_token,
            id_token: account.id_token,
            expires_at: account.expires_at,
            scope: account.scope,
            token_type: account.token_type,
            // refresh_token 只有 Google 有給才覆蓋,避免把舊的洗掉
            ...(account.refresh_token
              ? { refresh_token: account.refresh_token }
              : {}),
          },
        }
      )
      return account
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
  providers: [
    ...(connectMongo
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
            authorization: {
              params: {
                scope:
                  "openid email profile https://www.googleapis.com/auth/calendar.events",
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
  ...(connectMongo && {
    adapter: patchedAdapter(MongoDBAdapter(connectMongo)),
  }),
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  theme: {
    brandColor: config.colors.main,
    logo: "/logo.png",
  },
});