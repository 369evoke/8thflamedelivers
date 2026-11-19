import { Card } from "@/components/ui";
import { NotConfigured } from "@/components/ui";

export function AuthCard({ title, sub, configured, children }: { title: string; sub?: string; configured: boolean; children: React.ReactNode }) {
  return (
    <div className="px-5 py-16">
      <Card className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        <div className="mt-6">{configured ? children : <NotConfigured what="Authentication" env="NEXT_PUBLIC_SUPABASE_URL" />}</div>
      </Card>
    </div>
  );
}
