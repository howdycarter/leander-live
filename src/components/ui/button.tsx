/** Genuine UIARC button, themed with the site's pre-existing utility contract. */
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Button as ArcButton, type ButtonProps as ArcProps, type ButtonVariant } from "../arc/button/button";
import styles from "../arc/button/button.module.css";
import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "inline-flex min-h-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border-0 border-transparent text-sm font-medium leading-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  { variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      outline: "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
      link: "bg-transparent text-primary underline-offset-4 hover:underline",
    },
    size: { default: "h-9 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", lg: "h-10 rounded-md px-8", icon: "h-9 w-9 p-0" },
  }, defaultVariants: { variant: "default", size: "default" } },
);
export interface ButtonProps extends Omit<ArcProps, "variant" | "size">, VariantProps<typeof buttonVariants> { asChild?: boolean }
const variants: Record<string, ButtonVariant> = { default: "primary", destructive: "danger", outline: "secondary", secondary: "secondary", ghost: "ghost", link: "ghost" };
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ asChild, variant = "default", size = "default", className, ...props }, ref) {
  const classes = cn("arc-button-compat", buttonVariants({ variant, size, className }));
  // Preserve the actual React Router/anchor element, merged event handlers and refs.
  if (asChild) return <Slot ref={ref} className={cn(styles.button, styles[variants[variant ?? "default"]], classes)} {...props} />;
  return <ArcButton ref={ref} variant={variants[variant ?? "default"]} size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"} className={classes} {...props} />;
});
export { Button, buttonVariants };
