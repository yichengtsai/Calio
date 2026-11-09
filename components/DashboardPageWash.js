/**
 * Soft theme-aware page wash. Different tones per nav section.
 * Gradients are larger so the page does not look empty in the corners only.
 */
const TONES = {
  violet:
    "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #8b5cf6 22%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #c084fc 14%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #8b5cf6 8%, transparent), transparent 70%)",
  sky: "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #0ea5e9 22%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #38bdf8 14%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #0ea5e9 8%, transparent), transparent 70%)",
  emerald:
    "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #10b981 22%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #34d399 14%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #10b981 8%, transparent), transparent 70%)",
  amber:
    "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #f59e0b 20%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #fbbf24 14%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #f59e0b 8%, transparent), transparent 70%)",
  teal:
    "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #14b8a6 22%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #2dd4bf 14%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #14b8a6 8%, transparent), transparent 70%)",
  rose: "radial-gradient(ellipse 900px 480px at 15% 0%, color-mix(in oklab, #f43f5e 16%, transparent), transparent 68%), radial-gradient(ellipse 700px 400px at 95% 10%, color-mix(in oklab, #fb7185 12%, transparent), transparent 65%), radial-gradient(ellipse 500px 320px at 50% 80%, color-mix(in oklab, #f43f5e 7%, transparent), transparent 70%)",
};

export default function DashboardPageWash({ tone = "violet", children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-base-300/60 p-4 sm:p-6 shadow-sm min-h-[50vh] ${className}`}
      style={{
        backgroundImage: TONES[tone] || TONES.violet,
        backgroundRepeat: "no-repeat",
        backgroundColor: "var(--color-base-100)",
      }}
    >
      {children}
    </div>
  );
}
