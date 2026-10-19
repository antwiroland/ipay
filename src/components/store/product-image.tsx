import Image from "next/image";
import { cn } from "@/lib/utils";

/** Optimised product imagery. Vector renders are served as-is; raster uploads go through next/image. */
export function ProductImage({
  src,
  alt,
  className,
  priority,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      src={src || "/images/devices/placeholder.svg"}
      alt={alt}
      fill
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      unoptimized={src?.endsWith(".svg")}
      className={cn("object-contain", className)}
    />
  );
}
