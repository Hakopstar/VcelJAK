import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { jwtDecode } from 'jwt-decode';
import { setCookie } from 'nookies';
import { getCsrfToken } from 'next-auth/react';


export const authOptions : NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: "Username" },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log("Logging started")
  
        const res = await fetch('https://nginx/access/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
          credentials: 'include' // Ensure cookies are received
        });
    
        console.log("fetch")
        const user = await res.json()
        console.log(`User: ${user}`)
        
        if (!res.ok || !user.token) return null;
        const csrfToken = jwtDecode(user.token).csrf
        return {
          name: credentials?.username,
          accessToken: user.token,
          csrfToken: csrfToken
        }
      
      },
    }),
  ],
  callbacks: {
    async jwt({ token , user }) {
      if (user) {
        console.log("login")
        token.accessToken = user.accessToken
        token.csrfToken = user.csrfToken
        token.name = user.name
      }
      return token;
    },

    async session({ session, token}) {
      session.user = {
        name: token.name
      }
      
      
      session.csrfToken = token.csrfToken
      session.accessToken = token.accessToken;
     
      return session;
    }  
    
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 30 days - TODO: ADD Some logic
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
