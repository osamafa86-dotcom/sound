import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "مقام — استوديو الصوتيات بالذكاء الاصطناعي",
    template: "%s | مقام",
  },
  description:
    "منصة عربية لتحويل النص إلى صوت بجودة عالية، وكتابة وتلحين الأغاني حسب المقامات الصوتية بالذكاء الاصطناعي.",
  openGraph: {
    title: "مقام — استوديو الصوتيات بالذكاء الاصطناعي",
    description:
      "حوّل كلماتك إلى صوتٍ وأغنية: نص إلى صوت بالفصحى واللهجات، وأغانٍ ملحّنة على المقامات العربية.",
    type: "website",
    locale: "ar_AR",
  },
};

export const viewport = {
  themeColor: "#0a0e1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-body">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
