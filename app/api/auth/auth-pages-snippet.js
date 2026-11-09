// In libs/auth.js, inside NextAuth({ ... }), add:
//
//   pages: {
//     signIn: "/login",
//   },
//
// And in config.js:
//   auth: {
//     loginUrl: "/login",
//     callbackUrl: "/dashboard",
//   },
