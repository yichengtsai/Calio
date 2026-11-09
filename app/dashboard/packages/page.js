import ClientPackagesManager from "@/components/ClientPackagesManager";
import DashboardPageWash from "@/components/DashboardPageWash";

export default function PackagesPage() {
  return (
    <DashboardPageWash tone="emerald">
      <ClientPackagesManager />
    </DashboardPageWash>
  );
}
