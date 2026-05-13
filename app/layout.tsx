import type { Metadata } from "next";
import Script from "next/script";
import { PT_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DecorThemedImg } from "@/components/decor-themed-img";
import { LanguageProvider } from "@/components/language-provider";
import { ScreenEdgeDecor } from "@/components/screen-edge-decor";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const ptSerif = PT_Serif({
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
  display: "swap",
  adjustFontFallback: true,
  variable: "--font-pt-serif",
});

export const metadata: Metadata = {
  title: "Albion Price Checker",
  description: "Albion Online market prices by city",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={ptSerif.variable}>
      <body className="antialiased">
        <div className="relative z-10">
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=108754819', 'ym');

            ym(108754819, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/108754819"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <LanguageProvider>
          <SiteHeader />
          <div className="mx-auto mt-2 w-full max-w-6xl px-4 sm:px-6">
            <DecorThemedImg
              src="/decor/header-divider.svg"
              ratio={[1322, 4]}
              wrapperClassName="pointer-events-none block w-full select-none"
              imgClassName="block h-auto w-full select-none"
            />
          </div>
          {children}
          <Analytics />
          <SpeedInsights />
        </LanguageProvider>
        </div>
        <div className="edge-vignette" aria-hidden />
        <ScreenEdgeDecor />
      </body>
    </html>
  );
}
