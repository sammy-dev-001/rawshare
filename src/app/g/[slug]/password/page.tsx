"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { verifyGalleryPassword } from "@/app/actions/verifyPassword";
import { toast } from "sonner";

interface PasswordPageProps {
  params: Promise<{ slug: string }>;
}

export default function PasswordPage(props: PasswordPageProps) {
  const params = use(props.params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    const result = await verifyGalleryPassword(params.slug, password);
    setIsVerifying(false);

    if (result.success) {
      toast.success("Access granted");
      router.push(`/g/${params.slug}`);
    } else {
      toast.error(result.error || "Incorrect password");
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-bg px-4 font-sans text-zinc-100 relative">
      {/* Ambient Glow */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-teal-accent/5 blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-slate-surface/60 p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-zinc-300 border border-white/10 shadow-inner">
          <Lock className="h-7 w-7" />
        </div>
        
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Protected Gallery</h1>
        <p className="mb-8 text-sm text-zinc-400">
          This gallery is password protected. Please enter the password to view its contents.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/50 px-5 py-4 text-center text-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-accent/50 transition-all"
            autoFocus
          />
          <button
            type="submit"
            disabled={isVerifying || !password}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition-all hover:bg-zinc-200 disabled:bg-white/10 disabled:text-zinc-500"
          >
            {isVerifying ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Unlock Gallery
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
