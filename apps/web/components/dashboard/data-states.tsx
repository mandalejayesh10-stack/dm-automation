import { AlertCircle, Inbox } from "lucide-react";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md border border-white/10 bg-white/[0.06] ${className}`} />;
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="glass rounded-md p-5 text-sm text-white/70">
      <p className="flex items-center gap-2 font-bold text-pulse">
        <AlertCircle className="h-4 w-4" />
        Could not load data
      </p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass flex min-h-64 flex-col items-center justify-center rounded-md p-8 text-center">
      <Inbox className="h-10 w-10 text-signal" />
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-white/55">{body}</p>
    </div>
  );
}
