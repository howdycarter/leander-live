import { Children, isValidElement, type HTMLAttributes } from "react";
import { Alert as ArcAlert, type AlertProps as ArcAlertProps } from "../arc/alert/alert";
import { cn } from "@/lib/utils";
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />; }
export function AlertTitle({ children }: HTMLAttributes<HTMLDivElement>) { return <>{children}</>; }
export function Alert({ children, title, variant, className, ...props }: ArcAlertProps & { variant?: "default" | "destructive" }) {
  const nodes = Children.toArray(children);
  const description = nodes.find(node => isValidElement(node) && node.type === AlertDescription);
  const icon = nodes.find(node => isValidElement(node) && node.type !== AlertDescription && node.type !== AlertTitle);
  return <ArcAlert title={title} icon={icon} tone={variant === "destructive" ? "danger" : "info"} className={cn("arc-alert-compat relative w-full rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground shadow-none", variant === "destructive" && "border-destructive/50 text-destructive", className)} {...props}>{description ?? children}</ArcAlert>;
}
