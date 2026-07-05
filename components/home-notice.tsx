"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";

const STORAGE_KEY = "home-notice-dismissed";
/** Увеличьте версию, чтобы снова показать уведомление после смены текста. */
const NOTICE_VERSION = "2";
const isDev = process.env.NODE_ENV === "development";

export function HomeNotice() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(isDev);

  useEffect(() => {
    if (isDev) {
      setVisible(true);
      return;
    }
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (dismissed !== NOTICE_VERSION) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (!isDev) {
      try {
        window.localStorage.setItem(STORAGE_KEY, NOTICE_VERSION);
      } catch {
        /* ignore */
      }
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="home-notice fixed inset-x-0 bottom-0 z-[10050] flex justify-center p-4 sm:p-5">
      <div className="home-notice__panel relative isolate w-full max-w-[969px] overflow-hidden">
        <div
          className="home-notice__bg pointer-events-none absolute inset-0"
          aria-hidden
        />

        <div className="relative z-[1] grid min-h-[120px] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-[86px] pb-5 pl-[22px] pr-[38px] pt-4 sm:gap-x-5 sm:gap-y-[27px] sm:pb-6">
          <div className="flex min-w-0 flex-col justify-center gap-2 px-6">
            <p className="text-base font-bold leading-normal tracking-[0.02em] text-[#fff9f2]">
              {t("home.notice.title")}
            </p>
            <div className="text-sm leading-normal text-white">
              <p>{t("home.notice.p1")}</p>
              <p className="mt-1">{t("home.notice.p2")}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={t("home.notice.dismiss")}
            className="site-header-toggle inline-flex shrink-0 items-center justify-center"
          >
            <span className="site-header-toggle__disc">
              <X
                className="size-4 shrink-0 text-[#fcd27a] header-theme-icon"
                strokeWidth={2.8}
                aria-hidden
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
