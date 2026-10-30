/** Compound compatibility API retaining UIARC's dialog motion and Radix semantics. */
import { Children, isValidElement, forwardRef, useRef, type HTMLAttributes, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { DialogContent as ArcContent, type DialogContentProps } from "../arc/dialog/dialog";
import styles from "../arc/dialog/dialog.module.css";
import { cn } from "@/lib/utils";
export { Dialog, DialogTrigger, DialogClose } from "../arc/dialog/dialog";
export const DialogPortal = Primitive.Portal;
export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-dialog-heading flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />; }
export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />; }
export function DialogContent({ children, onOpenAutoFocus, onCloseAutoFocus, className, ...props }: DialogContentProps) {
  const opener = useRef<HTMLElement | null>(null);
  const nodes = Children.toArray(children);
  const header = nodes.find(node => isValidElement(node) && node.type === DialogHeader);
  return <ArcContent {...props} className={cn("arc-dialog-compat w-[calc(100%-2rem)] max-w-lg rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto sm:w-full", className)} header={header} onOpenAutoFocus={event => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpenAutoFocus?.(event);
  }} onCloseAutoFocus={event => {
    onCloseAutoFocus?.(event);
    if (!event.defaultPrevented && opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
  }}><div className="arc-dialog-body">{nodes.filter(node => node !== header)}</div></ArcContent>;
}
export const DialogTitle = forwardRef<ElementRef<typeof Primitive.Title>, ComponentPropsWithoutRef<typeof Primitive.Title>>(function DialogTitle({ className, ...props }, ref) { return <Primitive.Title ref={ref} className={cn(styles.title, "text-lg font-semibold leading-none tracking-tight", className)} {...props} />; });
export const DialogDescription = forwardRef<ElementRef<typeof Primitive.Description>, ComponentPropsWithoutRef<typeof Primitive.Description>>(function DialogDescription({ className, ...props }, ref) { return <Primitive.Description ref={ref} className={cn(styles.description, "mt-0 text-sm text-muted-foreground", className)} {...props} />; });
