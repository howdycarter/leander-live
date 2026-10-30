import { Children, isValidElement, type HTMLAttributes } from "react";
import { Alert as ArcAlert, type AlertProps as ArcAlertProps } from "../arc/alert/alert";
export function AlertDescription({ children }: HTMLAttributes<HTMLDivElement>) { return <>{children}</>; }
export function AlertTitle({ children }: HTMLAttributes<HTMLDivElement>) { return <>{children}</>; }
export function Alert({ children, title, variant, ...props }: Omit<ArcAlertProps, "title"> & { title?: string; variant?: "default" | "destructive" }) {
  const nodes = Children.toArray(children);
  const description = nodes.find(node => isValidElement(node) && node.type === AlertDescription);
  return <ArcAlert title={title ?? "Next step"} tone={variant === "destructive" ? "danger" : "info"} {...props}>{description ?? children}</ArcAlert>;
}
