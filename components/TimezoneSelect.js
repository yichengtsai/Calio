"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { getAllTimezones, formatTimezoneLabel } from "@/libs/timezone";

function GlobeIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" {...props}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.94 4.31a7.51 7.51 0 00-3.15 2.73c.34.1.7.18 1.08.24a13.6 13.6 0 011.44-2.5c.2-.17.42-.33.63-.47zm2.12 0c.2.14.42.3.63.47.6.68 1.09 1.53 1.44 2.5.38-.06.74-.14 1.08-.24a7.51 7.51 0 00-3.15-2.73zM6.02 8.7a11.9 11.9 0 00-.02 1.3c0 .44.02.88.05 1.3a12.8 12.8 0 001.9.19c-.03-.48-.05-.98-.05-1.49 0-.5.02-1 .05-1.49-.66.02-1.3.08-1.93.19zm7.03-.19c.03.49.05.99.05 1.49 0 .51-.02 1.01-.05 1.49a12.8 12.8 0 001.9-.19c.03-.42.05-.86.05-1.3 0-.44-.02-.88-.05-1.3a12.8 12.8 0 00-1.9-.19zM7.55 11.98c.09.79.24 1.53.46 2.19a9 9 0 003.98 0c.22-.66.37-1.4.46-2.19a15.4 15.4 0 01-4.9 0zm.02-4.46a15.4 15.4 0 014.86 0c-.09-.63-.23-1.22-.42-1.75a10.6 10.6 0 00-4.02 0c-.19.53-.33 1.12-.42 1.75zM5.79 12.99a8.6 8.6 0 01-1.08-.24 7.51 7.51 0 003.15 2.73 6.35 6.35 0 01-.63-.47c-.6-.68-1.09-1.53-1.44-2.5v.48zm8.42 0v-.48c-.35.97-.84 1.82-1.44 2.5-.2.17-.42.33-.63.47a7.51 7.51 0 003.15-2.73c-.34.1-.7.18-1.08.24z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * 給預約人自己挑時區用的搜尋式下拉選單。
 * value / onChange 都是 IANA 字串,例如 "Asia/Taipei"。
 */
export default function TimezoneSelect({ value, onChange, className = "" }) {
  const [query, setQuery] = useState("");
  const allTimezones = useMemo(() => getAllTimezones(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allTimezones.slice(0, 60);
    const q = query.toLowerCase();
    return allTimezones
      .filter((tz) => tz.toLowerCase().replace(/_/g, " ").includes(q))
      .slice(0, 60);
  }, [allTimezones, query]);

  return (
    <Combobox
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      onClose={() => setQuery("")}
    >
      <div className={`relative ${className}`}>
        <div className="relative flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <GlobeIcon className="w-4 h-4 shrink-0 text-base-content/40" />
          <ComboboxInput
            className="w-full bg-transparent outline-none placeholder:text-base-content/40"
            displayValue={(tz) => (tz ? formatTimezoneLabel(tz) : "")}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search timezone…"
          />
          <ComboboxButton className="shrink-0 text-base-content/40 hover:text-base-content/70">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom start"
          transition
          className="z-50 mt-1 max-h-64 w-[var(--input-width)] overflow-auto rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg [--anchor-gap:6px] transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-base-content/50">No matching timezone</div>
          ) : (
            filtered.map((tz) => (
              <ComboboxOption
                key={tz}
                value={tz}
                className="cursor-pointer px-3 py-2 text-sm data-[focus]:bg-base-200 data-[selected]:font-semibold"
              >
                {formatTimezoneLabel(tz)}
                <span className="ml-1.5 text-xs text-base-content/40">{tz}</span>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
