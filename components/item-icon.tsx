"use client";

import { useState } from "react";

import { getItemIconUrl } from "@/lib/item-icon";
import { cn } from "@/lib/utils";

type ItemIconProps = {
  itemId: string;
  quality?: number;
  size?: number;
  className?: string;
  alt?: string;
};

export function ItemIcon({
  itemId,
  quality,
  size = 32,
  className,
  alt = "",
}: ItemIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-medium text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden={!alt}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={getItemIconUrl(itemId, { quality, size })}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
