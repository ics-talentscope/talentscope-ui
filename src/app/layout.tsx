import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "plyr/dist/plyr.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Script from "next/script";
import { APP_DESCRIPTION, APP_KEYWORDS, APP_NAME } from "@/lib/brand";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [...APP_KEYWORDS],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="aqua" suppressHydrationWarning>
      <head />
      <body
        className={`${jakarta.variable} ${jakarta.className} bg-background text-foreground antialiased transition-colors duration-300 min-h-screen`}
      >
        <Script id="theme-script" strategy="beforeInteractive">
          {`
           (function() {
             try {
               var saved = localStorage.getItem('theme');
               var themes = ["misty-mountains", "aqua", "mustangs"];
               var theme = saved && themes.indexOf(saved) !== -1 ? saved : "aqua";
               document.documentElement.classList.remove("dark", "blue", "purple", "emerald", "rose", "sunset", "misty-mountains", "aqua", "mustangs");
               document.documentElement.classList.add(theme);
               localStorage.setItem('theme', theme);
             } catch (e) {
               document.documentElement.classList.add("aqua");
             }
           })();
         `}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
