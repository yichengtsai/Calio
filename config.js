const config = {
  // REQUIRED
  appName: "Calio",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Calio is a scheduling page for your time — share one link, let people book straight into your real availability, and keep it all in sync with Google Calendar automatically.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: "calio.app",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (resend.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    // Free 版沒有 Stripe priceId,Pricing.js 會特別處理,顯示「Get started free」而不是走 checkout
    plans: [
      {
        name: "Free",
        description: "Get a booking page live in minutes",
        price: 0,
        features: [
          { name: "1 event type" },
          { name: "Unlimited bookings" },
          { name: "Real-time availability from your rules" },
          { name: "Buffer time & minimum notice" },
          { name: "Booking confirmations, reminders & cancellations by email" },
          { name: "Approve or auto-confirm requests" },
          { name: "Custom booking page branding" },
        ],
      },
      {
        // This plan will look different on the pricing page, it will be highlighted. You can only have one plan with isFeatured: true
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1Niyy5AxyNprDp7iZIqEyD2h"
            : "price_pro_monthly",
        // Pro 是月費訂閱,checkout mode 要用 "subscription"(見 <ButtonCheckout mode="subscription" />)
        mode: "subscription",
        name: "Pro",
        description: "For anyone whose real calendar is the source of truth",
        price: 12,
        priceAnchor: 19,
        billingPeriod: "/month",
        features: [
          { name: "Everything in Free" },
          { name: "Unlimited event types" },
          { name: "Two-way Google Calendar sync" },
          { name: "Real-time busy check before every booking" },
          { name: "New bookings written straight to your Google Calendar" },
          { name: "Reschedules & cancellations kept in sync automatically" },
          { name: "Priority email support" },
        ],
      },
    ],
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `Calio <noreply@resend.calio.app>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
    fromAdmin: `Calio <hello@resend.calio.app>`,
    // Email shown to customer if need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
    supportEmail: "support@calio.app",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
    // OR you can just do this to use a custom color: main: "#f37055". HEX only.
    main: "hsl(var(--p))", // Uses the primary color from the DaisyUI theme dynamically
  },
  auth: {
    // REQUIRED — the path to log in users. It's use to protect private routes (like /dashboard). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/api/auth/signin",
    callbackUrl: "/dashboard",
  },
};

export default config;
