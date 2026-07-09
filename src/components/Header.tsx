import { SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "next/image";

export async function Header() {
  const { userId } = await auth();

  return (
    <header className="border-b border-zinc-800 bg-black sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
          <Image src="/icons/icon-192.png" alt="RawShare Logo" width={32} height={32} className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-lg hidden sm:inline">RawShare</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {!userId ? (
            <SignInButton mode="modal">
              <button className="text-sm font-medium text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
                Sign In
              </button>
            </SignInButton>
          ) : (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors mr-2">
                Dashboard
              </Link>
              <UserButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
