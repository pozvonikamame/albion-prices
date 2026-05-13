"use client";

import { cn } from "@/lib/utils";

const maskStyleBase = {
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center" as const,
};

type DecorThemedImgProps = {
  src: string;
  alt?: string;
  ratio: readonly [number, number];
  wrapperClassName?: string;
  imgClassName: string;
};

/**
 * Светлая тема: оригинальный img. Тёмная: тот же контур, заливка var(--decor-fill) (#404446).
 */
export function DecorThemedImg({ src, alt = "", ratio, wrapperClassName, imgClassName }: DecorThemedImgProps) {
  const [rw, rh] = ratio;
  const maskStyle = {
    ...maskStyleBase,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
  };

  return (
    <span
      className={cn("decor-themed relative inline-block w-full overflow-hidden", wrapperClassName)}
      style={{ aspectRatio: `${rw} / ${rh}` }}
    >
      <img
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        className={cn("decor-themed__light relative z-0 h-full w-full", imgClassName)}
      />
      <span
        aria-hidden
        className={cn(
          "decor-themed__dark pointer-events-none absolute inset-0 z-[1] bg-[var(--decor-fill)]",
          imgClassName,
        )}
        style={maskStyle}
      />
    </span>
  );
}

type DecorThemedImgFillProps = {
  src: string;
  alt?: string;
  wrapperClassName?: string;
  imgClassName: string;
};

/** Без aspect-ratio: размер задаёт img (например h-full w-auto у краёв экрана). */
export function DecorThemedImgFill({ src, alt = "", wrapperClassName, imgClassName }: DecorThemedImgFillProps) {
  const maskStyle = {
    ...maskStyleBase,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
  };

  return (
    <span className={cn("decor-themed relative inline-block", wrapperClassName)}>
      <img
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        className={cn("decor-themed__light relative z-0", imgClassName)}
      />
      <span
        aria-hidden
        className={cn(
          "decor-themed__dark pointer-events-none absolute inset-0 z-[1] bg-[var(--decor-fill)]",
          imgClassName,
        )}
        style={maskStyle}
      />
    </span>
  );
}
