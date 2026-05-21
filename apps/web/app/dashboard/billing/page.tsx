import { DashboardShell } from "@/components/dashboard/shell";

export default function BillingPage() {
  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <h1 className="text-4xl font-black">Billing</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {["Starter", "Pro", "Agency"].map((plan) => (
            <div key={plan} className="glass rounded-md p-5">
              <h2 className="text-2xl font-black">{plan}</h2>
              <p className="mt-3 text-white/55">Stripe and Razorpay subscription support with invoices and usage limits.</p>
              <button className="mt-6 w-full rounded-md bg-signal px-4 py-3 text-sm font-black text-black">Manage {plan}</button>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
