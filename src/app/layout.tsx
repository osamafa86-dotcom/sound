import type { Metadata } from "next";
import { Alexandria, Tajawal } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteBanner from "@/components/SiteBanner";

const alexandria = Alexandria({
  variable: "--font-alexandria",
  subsets: ["arabic", "latin"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
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
  themeColor: "#fbf8f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-body">
        <SiteBanner />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
