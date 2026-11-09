import AccountSettingsForm from "@/components/AccountSettingsForm";
import DashboardPageWash from "@/components/DashboardPageWash";

export default function SettingsPage() {
  return (
    <DashboardPageWash tone="amber" className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-base-content/55 mt-1">Profile and booking page</p>
      </div>
      <AccountSettingsForm />
    </DashboardPageWash>
  );
}
