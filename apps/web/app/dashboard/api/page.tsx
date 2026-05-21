import { DashboardShell } from "@/components/dashboard/shell";

export default function ApiSettingsPage() {
  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <h1 className="text-4xl font-black">API Settings</h1>
        <div className="glass mt-8 max-w-3xl rounded-md p-5">
          {["Meta App ID", "Meta Business Account ID", "OpenAI API", "Gemini API", "Webhook signing secret"].map((label) => (
            <label key={label} className="mb-4 block text-sm text-white/60">
              {label}
              <input className="mt-2 w-full rounded-md border border-white/10 bg-black/35 px-3 py-3 text-white outline-none focus:border-signal" placeholder="Configured in environment variables" />
            </label>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
