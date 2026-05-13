/**
 * Фиксированные SVG по краям экрана. Файлы: public/decor/edge-{top,bottom,left,right}.svg
 * Скрыто до breakpoint `md` (768px). pointer-events: none — не перехватывает клики.
 */

import { DecorThemedImg, DecorThemedImgFill } from "@/components/decor-themed-img";
import { cn } from "@/lib/utils";

const EDGE_TOP = "/decor/edge-top.svg";
const EDGE_BOTTOM = "/decor/edge-bottom.svg";
const EDGE_LEFT = "/decor/edge-left.svg";
const EDGE_RIGHT = "/decor/edge-right.svg";

const layer = "pointer-events-none fixed z-[10000] hidden select-none md:block";

export function ScreenEdgeDecor() {
  return (
    <>
      <div aria-hidden className={cn(layer, "inset-x-0 top-0 w-full")}>
        <DecorThemedImg
          src={EDGE_TOP}
          ratio={[1920, 35]}
          wrapperClassName="block w-full"
          imgClassName="block h-auto w-full max-w-none"
        />
      </div>
      <div aria-hidden className={cn(layer, "inset-x-0 -bottom-px w-full")}>
        <DecorThemedImg
          src={EDGE_BOTTOM}
          ratio={[1920, 34]}
          wrapperClassName="block w-full"
          imgClassName="block h-auto w-full max-w-none"
        />
      </div>
      <div aria-hidden className={cn(layer, "-bottom-px -left-px top-0 w-auto")}>
        <DecorThemedImgFill
          src={EDGE_LEFT}
          wrapperClassName="block h-full w-auto"
          imgClassName="block h-full w-auto max-w-none"
        />
      </div>
      <div aria-hidden className={cn(layer, "-bottom-px -right-px top-0 w-auto")}>
        <DecorThemedImgFill
          src={EDGE_RIGHT}
          wrapperClassName="block h-full w-auto"
          imgClassName="block h-full w-auto max-w-none"
        />
      </div>
    </>
  );
}
