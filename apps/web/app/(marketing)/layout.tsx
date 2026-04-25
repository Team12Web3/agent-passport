import { Footer } from "@/components/shell/Footer";
import { MarketingNav } from "@/components/shell/MarketingNav";

export default function MarketingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08111d] text-white">
      <MarketingNav />
      {children}
      <Footer />
    </div>
  );
}
