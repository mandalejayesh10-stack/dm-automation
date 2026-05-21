import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-signal",
        variant === "primary" && "bg-signal text-black hover:bg-white",
        variant === "secondary" && "border border-white/12 bg-white/8 text-white hover:border-signal/60 hover:bg-white/12",
        variant === "ghost" && "text-white/75 hover:bg-white/10 hover:text-white",
        className
      )}
      {...props}
    />
  );
}
