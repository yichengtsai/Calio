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
			data-theme="deepwork"
			className={font.className}
			suppressHydrationWarning
		>
			<body>
				{/* 翻頁前就先套用使用者上次選的主題,避免畫面先閃一下錯的顏色再變回來 */}
				<Script id="theme-init" strategy="beforeInteractive">
					{`
						try {
							var t = localStorage.getItem('theme') || 'deepwork';
							document.documentElement.setAttribute('data-theme', t);
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
