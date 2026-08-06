/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // NextJS <Image> component needs to whitelist domains for src={}
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "logos-world.net",
      },
    ],
  },
  // 這幾個套件不要讓 webpack 打包,直接用 Node.js 原生 require 讀取
  // googleapis 系列套件內部用了動態 require,webpack 打包會失敗
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "googleapis-common",
    "gaxios",
    "gcp-metadata",
    "gtoken",
  ],
  webpack: (config, { webpack, isServer }) => {
    // Ignore MongoDB's optional dependencies to prevent build warnings
    // 注意:gcp-metadata 拿掉了,因為 googleapis 真的需要用到它
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(kerberos|@mongodb-js\/zstd|@aws-sdk\/credential-providers|snappy|socks|aws4|mongodb-client-encryption)$/,
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig;
