import { ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";

export default function AdminPage() {
  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <p className="font-semibold text-signal">Internal operations</p>
        <h1 className="mt-2 text-4xl font-black">Admin panel</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {["Manage users", "Subscriptions", "API usage", "Abuse bans"].map((item) => (
            <div key={item} className="glass rounded-md p-5">
              <ShieldAlert className="h-5 w-5 text-signal" />
              <h2 className="mt-5 font-bold">{item}</h2>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
