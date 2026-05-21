import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Bot, Check, MessagesSquare, Network, Sparkles, Users, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { PhoneDemo } from "@/components/marketing/phone-demo";
import { getServerSessionClaims } from "@/lib/session";

export default async function LandingPage() {
  const session = await getServerSessionClaims();
  if (session) redirect("/dashboard");

  const features = [
    ["AI auto replies", Bot],
    ["Viral reel AI", Sparkles],
    ["Analytics", BarChart3],
    ["Multi-brand management", Network],
    ["Automation flows", Workflow],
    ["Team collaboration", Users]
  ];

  const plans = [
    ["Starter", "$29", "For creators launching DM automation", ["2 brands", "5 automations", "Basic analytics"]],
    ["Pro", "$79", "For growing brands and operators", ["10 brands", "AI replies", "Inbox and lead scoring"]],
    ["Agency", "$199", "For teams managing many clients", ["Unlimited clients", "RBAC", "Priority support"]]
  ];

  return (
    <main className="overflow-hidden bg-ink text-white">
      <nav className="fixed left-0 right-0 top-0 z-30 border-b border-white/10 bg-ink/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-signal font-black text-black">AI</span>
            Social Automations
          </Link>
          <div className="hidden items-center gap-6 text-sm text-white/65 md:flex">
            <a href="#demo">Demo</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-signal px-5 text-sm font-semibold text-black transition hover:bg-white"
          >
            Google login
          </Link>
        </div>
      </nav>

      <section className="grid-bg relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-4 pb-16 pt-28 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-signal/25 bg-signal/10 px-4 py-2 text-sm font-semibold text-signal">
            Comment-to-DM automation for serious growth teams
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-normal md:text-7xl">
            AI Social Media Automation Platform
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
            Connect Instagram and Facebook, trigger DMs from comments, qualify leads with AI, manage every brand, and prove growth from one premium workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <GoogleLoginButton label="Continue with Google" />
            <a href="#demo">
              <Button variant="secondary" className="w-full sm:w-auto">
                Watch demo
              </Button>
            </a>
          </div>
        </div>
        <PhoneDemo />
      </section>

      <section id="demo" className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {["Comment appears", "AI sends DM", "Lead gets tagged"].map((item, index) => (
            <div key={item} className="glass rounded-md p-6">
              <span className="text-sm font-bold text-signal">0{index + 1}</span>
              <h2 className="mt-4 text-2xl font-bold">{item}</h2>
              <p className="mt-3 text-white/62">
                {index === 0 && "Detect keywords like price, link, course, or waitlist across reels and posts."}
                {index === 1 && "Send personalized Instagram or Messenger replies with typing states and saved templates."}
                {index === 2 && "Collect email, phone, tags, source, and conversion events for the CRM and analytics."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-white/10 bg-white/[0.03] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-2xl">
            <p className="font-semibold text-signal">Feature grid</p>
            <h2 className="mt-3 text-4xl font-black">Everything operators expect from ManyChat and Metricool, rebuilt around AI.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([label, Icon]) => (
              <div key={label as string} className="glass rounded-md p-6">
                <Icon className="h-6 w-6 text-signal" />
                <h3 className="mt-5 text-xl font-bold">{label as string}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">Production-ready workflows, permissions, and reporting for multi-account social teams.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-semibold text-signal">Dashboard preview</p>
            <h2 className="mt-3 text-4xl font-black">Analytics, inbox, builder, and brand switching in one workspace.</h2>
          </div>
          <div className="glass rounded-md p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {["12.8k comments", "8.9k DMs sent", "34% conversion"].map((stat) => (
                <div key={stat} className="rounded-md bg-black/45 p-4 font-bold">
                  {stat}
                </div>
              ))}
            </div>
            <div className="mt-4 grid min-h-64 gap-4 md:grid-cols-[1fr_0.7fr]">
              <div className="rounded-md bg-black/45 p-4">
                <Workflow className="mb-6 h-5 w-5 text-signal" />
                <div className="space-y-3">
                  {["Comment Trigger", "AI Reply", "Collect Email", "Send Offer"].map((node) => (
                    <div key={node} className="rounded-md border border-signal/25 bg-signal/10 px-4 py-3 text-sm font-semibold">
                      {node}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-black/45 p-4">
                <MessagesSquare className="mb-5 h-5 w-5 text-pulse" />
                <p className="rounded-md bg-pulse px-3 py-2 text-sm">Sure, I sent the link.</p>
                <p className="mt-3 rounded-md bg-white/10 px-3 py-2 text-sm">Can I get the bonus?</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map(([name, price, description, items]) => (
            <div key={name as string} className="glass rounded-md p-6">
              <h3 className="text-2xl font-black">{name as string}</h3>
              <p className="mt-3 text-white/60">{description as string}</p>
              <p className="mt-6 text-4xl font-black">
                {price as string}
                <span className="text-base text-white/48">/mo</span>
              </p>
              <div className="mt-6 space-y-3">
                {(items as string[]).map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm text-white/72">
                    <Check className="h-4 w-4 text-signal" />
                    {item}
                  </p>
                ))}
              </div>
              <Button className="mt-7 w-full" variant={name === "Pro" ? "primary" : "secondary"}>
                Choose {name as string}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-4xl font-black">FAQ</h2>
        {["Does this support public Meta OAuth?", "Can agencies manage multiple brands?", "Are Stripe and Razorpay supported?"].map((question) => (
          <details key={question} className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-5">
            <summary className="cursor-pointer font-semibold">{question}</summary>
            <p className="mt-3 text-white/62">Yes. The production flow is designed around approved Meta permissions, secure tokens, role-based access, and deployable billing boundaries.</p>
          </details>
        ))}
      </section>

      <footer className="border-t border-white/10 px-4 py-10 text-center text-sm text-white/45">
        AI Social Media Automation Platform. Built for creators, brands, and agencies.
      </footer>
    </main>
  );
}
