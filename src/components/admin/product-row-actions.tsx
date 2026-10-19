"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { productFlagsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DeleteProductDialog } from "./delete-product";

export function ProductRowActions({ id, name, hasOrders, flags }: { id: string; name: string; hasOrders: boolean; flags: { isPublished: boolean; isFeatured: boolean; isAvailable: boolean; isArchived: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const flag = (f: Partial<typeof flags>) =>
    start(async () => {
      const r = await productFlagsAction(id, f);
      if (r.ok) {
        toast.success(r.message ?? "Updated");
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} disabled={pending}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild><Link href={`/admin/products/${id}/edit`}>Edit details & prices</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          {!flags.isArchived && <DropdownMenuItem onSelect={() => flag({ isPublished: !flags.isPublished })}>{flags.isPublished ? "Unpublish" : "Publish"}</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => flag({ isFeatured: !flags.isFeatured })}>{flags.isFeatured ? "Remove from featured" : "Mark featured"}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => flag({ isAvailable: !flags.isAvailable })}>{flags.isAvailable ? "Mark unavailable" : "Mark available"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => flag({ isArchived: !flags.isArchived })}>{flags.isArchived ? "Restore from archive" : "Archive (discontinue)"}</DropdownMenuItem>
          <DropdownMenuItem className="text-danger [&_svg]:text-danger" onSelect={() => setDeleteOpen(true)}>Delete…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteProductDialog id={id} name={name} hasOrders={hasOrders} open={deleteOpen} onOpenChange={setDeleteOpen} onArchive={() => flag({ isArchived: true })} />
    </>
  );
}
