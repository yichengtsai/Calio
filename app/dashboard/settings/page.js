import AccountSettingsForm from "@/components/AccountSettingsForm";

export default function SettingsPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Settings</h1>
        <p className="text-base-content/60">
          Set your username to get your public booking page link.
        </p>
      </div>

      <AccountSettingsForm />
    </section>
  );
}
