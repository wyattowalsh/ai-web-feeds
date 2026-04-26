import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  default:
    "border border-transparent bg-[color:var(--brand)] text-[color:var(--fd-primary-foreground)] hover:bg-[color:var(--brand-strong)]",
  primary:
    "border border-transparent bg-[color:var(--brand)] text-[color:var(--fd-primary-foreground)] hover:bg-[color:var(--brand-strong)]",
  outline:
    "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand-strong)]",
  ghost:
    "border border-transparent bg-transparent text-[color:var(--ink-muted)] hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand-strong)]",
  secondary:
    "border border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--ink)] hover:bg-[color:var(--surface)] hover:text-[color:var(--brand-strong)]",
} as const;

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]",
  {
    variants: {
      variant: variants,
      // fumadocs use `color` instead of `variant`
      color: variants,
      size: {
        default: "min-h-11 px-4 py-2.5",
        lg: "min-h-12 px-5 py-3 text-sm",
        sm: "gap-1 px-2 py-1.5 text-xs",
        icon: "p-1.5 [&_svg]:size-5",
        "icon-sm": "p-1.5 [&_svg]:size-4.5",
        "icon-xs": "p-1 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  color,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, color, size }), className)}
      {...props}
    />
  );
}
