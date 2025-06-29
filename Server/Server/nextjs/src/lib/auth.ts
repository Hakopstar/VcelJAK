"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "next-auth/react";
import Credentials from "next-auth/providers/credentials";
import NextAuth from 'next-auth'
import jwtDecode from "jwt-decode";

const NEXT_AUTH = process.env.NEXT_PUBLIC_API_BASE_URL || ''

export function useLogout() {
  const router = useRouter();
  const { data: session } = useSession();
  const logout = async () => {
    console.log("Session_useLogout")
    console.log(session?.accessToken)
    console.log(session?.csrfToken)
    if (!session) {
      console.error("Missing Session Data");
      await signOut({ redirect: false });
      router.push("/login");
      return;
    }
    try {
      const res = await fetch(`${NEXT_AUTH}/access/logout`, {
        method: "POST",
        credentials: "include", // Send cookies
        headers: {
          "Content-Type": "text/plain",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
      });

      if (res.ok) {
        console.log("Blacklist success");
      } else {
        console.error("Logout failed", await res.json());
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    await signOut({ redirect: false });
    router.push("/login");
  };

  return logout; // Return the function itself, not the result of calling it
}
