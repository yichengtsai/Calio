"use client";

import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 9a1 1 0 100 2h1a1 1 0 100-2h-1zM2 9a1 1 0 100 2h1a1 1 0 100-2H2zm2.05 6.95a1 1 0 001.414 0l.707-.707a1 1 0 00-1.414-1.414l-.707.707a1 1 0 000 1.414zm1.414-11.9a1 1 0 00-1.414 1.414l.707.707A1 1 0 006.171 4.75l-.707-.707zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // 先給 null,mount 之後才讀真正的值,避免 SSR/瀏覽器對不上

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "deepwork";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "deepwork" ? "light" : "deepwork";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  // 還沒 mount 前不渲染任何東西,避免 hydration 對不上(跟之前處理過的問題同一類)
  if (!theme) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title={theme === "deepwork" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full border border-base-300 bg-base-100 shadow-lg flex items-center justify-center text-base-content/70 hover:text-base-content hover:scale-105 transition-all"
    >
      {theme === "deepwork" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
