import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "public_repo read:user user:email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.githubUsername = (profile as { login?: string })?.login;
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as SessionWithToken).accessToken = token.accessToken as string;
      (session as unknown as SessionWithToken).githubUsername = token.githubUsername as string;
      return session;
    },
  },
});

// Extended session type for use throughout the app
export interface SessionWithToken {
  accessToken: string;
  githubUsername: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
}
