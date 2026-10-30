/** Compatibility surface backed by the actual UIARC button implementation. */
import { forwardRef, cloneElement, isValidElement, type ReactElement } from "react";
import { Button as ArcButton, type ButtonProps as ArcButtonProps, type ButtonVariant } from "../arc/button/button";
import styles from "../arc/button/button.module.css";
import { cn } from "@/lib/utils";

type LegacyVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type LegacySize = "default" | "sm" | "lg" | "icon";
export interface ButtonProps extends Omit<ArcButtonProps, "variant" | "size"> {
  variant?: LegacyVariant;
  size?: LegacySize;
  asChild?: boolean;
}
const variants: Record<LegacyVariant, ButtonVariant> = {
  default: "primary", destructive: "danger", outline: "secondary", secondary: "secondary", ghost: "ghost", link: "ghost",
};
export function buttonVariants({ variant = "default", size = "default", className }: { variant?: LegacyVariant | null; size?: LegacySize | null; className?: string } = {}) {
  return cn(styles.button, styles[variants[variant ?? "default"]], styles[size === "sm" ? "sm" : size === "lg" ? "lg" : "md"], "arc-button-compat", size === "icon" && "arc-icon-button", variant === "link" && "arc-link-button", className);
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ asChild, variant = "default", size = "default", className, children, ...props }, ref) {
  // Keep native links as links rather than nesting an anchor in a button. They use
  // the same genuine UIARC CSS; only the button-only label/press animation is omitted.
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { ...props, className: cn(buttonVariants({ variant, size, className }), child.props.className) });
  }
  return <ArcButton ref={ref} variant={variants[variant]} size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"} className={cn("arc-button-compat", size === "icon" && "arc-icon-button", variant === "link" && "arc-link-button", className)} {...props}>{children}</ArcButton>;
});
