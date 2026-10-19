"use client";

import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------- Dialog ---------------- */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, ...props }: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[#0b1220]/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_.2s_ease-out]" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[16px] border border-border bg-surface p-6 shadow-[var(--shadow-lift)] focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="mb-4 pr-8">
          <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
          {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        </div>
        {children}
        <D.Close className="absolute top-4 right-4 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/* ---------------- Sheet (mobile nav / side panels) ---------------- */
export function SheetContent({ className, children, side = "right", title, ...props }: React.ComponentProps<typeof D.Content> & { side?: "left" | "right"; title: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[#0b1220]/40" />
      <D.Content
        className={cn(
          "fixed top-0 bottom-0 z-50 flex w-[86%] max-w-sm flex-col bg-surface shadow-[var(--shadow-lift)] focus:outline-none",
          side === "right" ? "right-0" : "left-0",
          className,
        )}
        {...props}
      >
        <D.Title className="sr-only">{title}</D.Title>
        <D.Description className="sr-only">{title}</D.Description>
        {children}
        <D.Close className="absolute top-4 right-4 rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Close menu">
          <X className="size-5" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/* ---------------- Dropdown ---------------- */
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={8}
        className={cn("z-50 min-w-52 rounded-[12px] border border-border bg-surface p-1.5 shadow-[var(--shadow-lift)]", className)}
        {...props}
      />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted",
        className,
      )}
      {...props}
    />
  );
}
export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}
export const DropdownMenuLabel = ({ className, ...props }: React.ComponentProps<typeof DM.Label>) => (
  <DM.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...props} />
);

/* ---------------- Tabs ---------------- */
export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("pt-5 focus:outline-none", className)} {...props} />;
}
