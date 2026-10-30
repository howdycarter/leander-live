/** Converts the existing compound call sites into UIARC's options-based Select. */
import { Children, isValidElement, type ReactNode, type HTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithoutRef } from "react";
import * as Primitive from "@radix-ui/react-select";
import { Select as ArcSelect } from "../arc/select/select";
import { cn } from "@/lib/utils";
type NodeProps = { children?: ReactNode; value?: string; disabled?: boolean; id?: string; className?: string; placeholder?: string; "aria-label"?: string };
function collect(children: ReactNode, type: unknown): React.ReactElement<NodeProps>[] {
  return Children.toArray(children).flatMap(node => {
    if (!isValidElement<NodeProps>(node)) return [];
    return node.type === type ? [node] : collect(node.props.children, type);
  });
}
function textContent(node: ReactNode): string {
  return Children.toArray(node).map(item => isValidElement<NodeProps>(item) ? textContent(item.props.children) : typeof item === "string" || typeof item === "number" ? String(item) : "").join("");
}
export function Select({ children, ...props }: ComponentPropsWithoutRef<typeof Primitive.Root>) {
  const trigger = collect(children, SelectTrigger)[0];
  const value = collect(children, SelectValue)[0];
  const label = trigger?.props["aria-label"];
  const options = collect(children, SelectItem).map(item => ({ value: item.props.value ?? "", label: textContent(item.props.children), disabled: item.props.disabled }));
  // When a surrounding native label exists, its htmlFor remains attached to
  // the real UIARC trigger ID; otherwise the supplied aria-label is made visible.
  return <div className={cn("arc-select-compat", !label && "arc-select-external-label")}><ArcSelect {...props} id={trigger?.props.id} className={trigger?.props.className} label={label ?? ""} placeholder={value?.props.placeholder} options={options} /></div>;
}
export function SelectTrigger(_props: ButtonHTMLAttributes<HTMLButtonElement>) { return null; }
export function SelectValue(_props: { children?: ReactNode; placeholder?: string }) { return null; }
export function SelectContent(_props: HTMLAttributes<HTMLDivElement>) { return null; }
export function SelectGroup(_props: HTMLAttributes<HTMLDivElement>) { return null; }
export function SelectItem(_props: HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }) { return null; }
