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

function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  // 避免系統 prefers-color-scheme 干擾 daisyUI
  root.style.colorScheme = next === "deepwork" ? "dark" : "light";
  try {
    localStorage.setItem("theme", next);
  } catch (e) {}
  // 清掉頁面內任何寫死的 data-theme，避免局部覆蓋全域
  document.querySelectorAll("[data-theme]").forEach((el) => {
    if (el !== root) el.removeAttribute("data-theme");
  });
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    let current = "light";
    try {
      current =
        localStorage.getItem("theme") ||
        document.documentElement.getAttribute("data-theme") ||
        "light";
    } catch (e) {}
    if (current !== "light" && current !== "deepwork") current = "light";
    applyTheme(current);
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "light" ? "deepwork" : "light";
    applyTheme(next);
    setTheme(next);
  }

  if (!theme) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="fixed bottom-4 right-4 z-[9999] w-11 h-11 rounded-full border border-base-300 bg-base-100 shadow-xl flex items-center justify-center text-base-content/80 hover:text-base-content hover:scale-105 transition-all"
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
