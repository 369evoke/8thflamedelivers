import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSessionUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Header signedIn={!!user} />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
