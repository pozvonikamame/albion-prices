"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { latinNameToCyrillicSearchString } from "@/src/lib/latin-to-cyrillic-search";

/** Пример названия карты: латиница → та же строка «как на русской раскладке» для поиска */
const DEMO_LATIN = "Setent-In-Qinsum";
const DEMO_CYR = latinNameToCyrillicSearchString(DEMO_LATIN);

const TYPE_MS = 130;
const DELETE_MS = 75;
const PAUSE_AFTER_LATIN = 1000;
const PAUSE_BEFORE_CYR = 450;
const PAUSE_AFTER_CYR = 2400;
const PAUSE_LOOP = 1400;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

type HomeSearchTypingDemoProps = {
  /** Показывать цикл только когда поле пустое и не в фокусе */
  active: boolean;
  className?: string;
};

export function HomeSearchTypingDemo({ active, className }: HomeSearchTypingDemoProps) {
  const [displayed, setDisplayed] = useState("");
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    if (!active || reduceMotion) {
      setDisplayed("");
      return;
    }

    let cancelled = false;
    const pending = new Set<number>();

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const tid = window.setTimeout(() => {
          pending.delete(tid);
          resolve();
        }, ms);
        pending.add(tid);
      });

    (async () => {
      while (!cancelled) {
        for (let i = 1; i <= DEMO_LATIN.length && !cancelled; i += 1) {
          setDisplayed(DEMO_LATIN.slice(0, i));
          await sleep(TYPE_MS);
        }
        if (cancelled) break;
        await sleep(PAUSE_AFTER_LATIN);
        for (let i = DEMO_LATIN.length - 1; i >= 0 && !cancelled; i -= 1) {
          setDisplayed(DEMO_LATIN.slice(0, i));
          await sleep(DELETE_MS);
        }
        if (cancelled) break;
        await sleep(PAUSE_BEFORE_CYR);
        for (let i = 1; i <= DEMO_CYR.length && !cancelled; i += 1) {
          setDisplayed(DEMO_CYR.slice(0, i));
          await sleep(TYPE_MS);
        }
        if (cancelled) break;
        await sleep(PAUSE_AFTER_CYR);
        for (let i = DEMO_CYR.length - 1; i >= 0 && !cancelled; i -= 1) {
          setDisplayed(DEMO_CYR.slice(0, i));
          await sleep(DELETE_MS);
        }
        if (cancelled) break;
        await sleep(PAUSE_LOOP);
      }
    })();

    return () => {
      cancelled = true;
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
    };
  }, [active, reduceMotion]);

  if (!active) return null;

  if (reduceMotion) {
    return (
      <span aria-hidden className={className} style={{ fontVariantLigatures: "none" }}>
        <span className="opacity-90">{DEMO_LATIN}</span>
        <span className="mx-1.5 opacity-45">→</span>
        <span>{DEMO_CYR}</span>
      </span>
    );
  }

  return (
    <span aria-hidden className={className} style={{ fontVariantLigatures: "none" }}>
      {displayed}
      <span className="ml-0.5 inline-block translate-y-px font-light leading-none text-[var(--home-input-text)] opacity-35 animate-pulse">
        ▍
      </span>
    </span>
  );
}
