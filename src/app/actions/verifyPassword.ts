"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function verifyGalleryPassword(slug: string, password: string) {
  try {
    const gallery = await prisma.gallery.findUnique({ 
      where: { slug }, 
      select: { passwordHash: true } 
    });
    
    if (!gallery || !gallery.passwordHash) {
      return { success: false, error: "Gallery not found or not password protected." };
    }
    
    const isValid = await bcrypt.compare(password, gallery.passwordHash);
    if (!isValid) {
      return { success: false, error: "Incorrect password." };
    }
    
    const cookieStore = await cookies();
    cookieStore.set(`gallery_access_${slug}`, "true", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/", 
      maxAge: 60 * 60 * 24 * 7 // 1 week 
    });
    
    return { success: true };
  } catch (error) {
    console.error("Password verification error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
