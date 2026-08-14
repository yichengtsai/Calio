import { Inter } from "next/font/google";
import Script from "next/script";
import { getSEOTags } from "@/libs/seo";
import ClientLayout from "@/components/LayoutClient";
import ThemeToggle from "@/components/ThemeToggle";
import config from "@/config";
import "./globals.css";

const font = Inter({ subsets: ["latin"] });

export const viewport = {
	// Will use the primary color of your theme to show a nice theme color in the URL bar of supported browsers
	themeColor: config.colors.main,
	width: "device-width",
	initialScale: 1,
};

// This adds default SEO tags to all pages in our app.
// You can override them in each page passing params to getSOTags() function.
export const metadata = getSEOTags();

export default function RootLayout({ children }) {
	return (
		<html
			lang="en"
			data-theme="light"
			className={font.className}
			suppressHydrationWarning
			translate="no"
		>
			<head>
				{/* 避免 Chrome / Google 翻譯外掛直接改寫頁面文字節點:它會把文字包進額外的 <font> 標籤,
				    跟 React 自己記住的 DOM 結構對不上,之後 React 想更新/移除那些節點時就會噴
				    "Failed to execute 'removeChild' on 'Node'"。這個 meta tag 請瀏覽器不要自動翻譯這頁。 */}
				<meta name="google" content="notranslate" />
			</head>
			<body>
				{/* 翻頁前就先套用使用者上次選的主題,避免畫面先閃一下錯的顏色再變回來 */}
				<Script id="theme-init" strategy="beforeInteractive">
					{`
						try {
							var t = localStorage.getItem('theme') || 'light';
							if (t !== 'light' && t !== 'deepwork') t = 'light';
							document.documentElement.setAttribute('data-theme', t);
							document.documentElement.style.colorScheme = t === 'deepwork' ? 'dark' : 'light';
						} catch (e) {}
					`}
				</Script>

				{/* ClientLayout contains all the client wrappers (Crisp chat support, toast messages, tooltips, etc.) */}
				<ClientLayout>{children}</ClientLayout>

				{/* 深色/淺色切換按鈕,固定在右下角,每一頁都看得到 */}
				<ThemeToggle />
			</body>
		</html>
	);
}
