// =============================================================================
// Auth.js v5 Configuration: GitHub OAuth with Access Token Exposure
// =============================================================================
// File: src/auth.ts
//
// This configuration:
// 1. Sets up GitHub as an OAuth provider with `public_repo` scope
// 2. Captures the GitHub access token in the JWT callback
// 3. Exposes the token via the session callback for server-side API calls
// 4. Augments TypeScript types for type safety
// =============================================================================

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // Request the public_repo scope so we can create public repos
      // For private repos, change to: scope: "repo"
      authorization: {
        params: {
          scope: "public_repo",
        },
      },
    }),
  ],

  callbacks: {
    // The jwt callback runs on every token creation/update.
    // On first sign-in, `account` contains the OAuth tokens.
    async jwt({ token, account, profile }) {
      if (account) {
        // First-time login: capture the GitHub access token
        token.accessToken = account.access_token;
        token.githubUsername = profile?.login as string;
      }
      return token;
    },

    // The session callback controls what's available via `auth()` or `useSession()`.
    // We forward the access token and username to the session object.
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.githubUsername = token.githubUsername as string;
      return session;
    },
  },
});

// =============================================================================
// TypeScript Module Augmentation
// =============================================================================
// Extend the default Auth.js types to include our custom fields.

declare module "next-auth" {
  interface Session {
    accessToken: string;
    githubUsername: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubUsername?: string;
  }
}

// =============================================================================
// Route Handler: src/app/api/auth/[...nextauth]/route.ts
// =============================================================================
// export { handlers as GET, handlers as POST } from "@/auth";

// =============================================================================
// GitHub API: Create Repo + Push Files (src/lib/github.ts)
// =============================================================================

interface PluginFile {
  path: string; // e.g. ".claude-plugin/manifest.json"
  content: string; // file content as string
}

interface CreateRepoResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

/**
 * Creates a GitHub repo and pushes plugin files in a single atomic commit.
 *
 * Flow:
 * 1. POST /user/repos (create repo with auto_init)
 * 2. GET  /repos/{owner}/{repo}/git/ref/heads/main (get HEAD ref)
 * 3. GET  /repos/{owner}/{repo}/git/commits/{sha} (get tree SHA)
 * 4. POST /repos/{owner}/{repo}/git/trees (create tree with all files)
 * 5. POST /repos/{owner}/{repo}/git/commits (create commit)
 * 6. PATCH /repos/{owner}/{repo}/git/refs/heads/main (update ref)
 */
export async function createPluginRepo(
  accessToken: string,
  repoName: string,
  description: string,
  files: PluginFile[]
): Promise<CreateRepoResult> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  const ghApi = "https://api.github.com";

  try {
    // Step 1: Create the repository
    const createRepoRes = await fetch(`${ghApi}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: repoName,
        description,
        private: false,
        auto_init: true, // Creates initial commit with README
      }),
    });

    if (!createRepoRes.ok) {
      const error = await createRepoRes.json();
      // Check for "name already exists" specifically
      const nameExists = error.errors?.some(
        (e: { message: string }) => e.message === "name already exists on this account"
      );
      if (nameExists) {
        return { success: false, error: "REPO_EXISTS" };
      }
      return { success: false, error: `Failed to create repo: ${error.message}` };
    }

    const repo = await createRepoRes.json();
    const owner = repo.owner.login;
    const repoFullName = `${owner}/${repoName}`;

    // Step 2: Get the default branch HEAD reference
    // Small delay to allow auto_init to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const refRes = await fetch(`${ghApi}/repos/${repoFullName}/git/ref/heads/main`, {
      headers,
    });

    if (!refRes.ok) {
      return { success: false, error: "Failed to get branch reference" };
    }

    const ref = await refRes.json();
    const headCommitSha = ref.object.sha;

    // Step 3: Get the tree SHA from the HEAD commit
    const commitRes = await fetch(
      `${ghApi}/repos/${repoFullName}/git/commits/${headCommitSha}`,
      { headers }
    );

    if (!commitRes.ok) {
      return { success: false, error: "Failed to get HEAD commit" };
    }

    const headCommit = await commitRes.json();
    const baseTreeSha = headCommit.tree.sha;

    // Step 4: Create a new tree with all plugin files
    // Using `content` field directly -- GitHub creates blobs automatically
    const treeEntries = files.map((file) => ({
      path: file.path,
      mode: "100644" as const, // Regular file
      type: "blob" as const,
      content: file.content,
    }));

    const treeRes = await fetch(`${ghApi}/repos/${repoFullName}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    });

    if (!treeRes.ok) {
      return { success: false, error: "Failed to create tree" };
    }

    const newTree = await treeRes.json();

    // Step 5: Create a new commit
    const newCommitRes = await fetch(`${ghApi}/repos/${repoFullName}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Add Claude plugin structure (via BotCamp)",
        tree: newTree.sha,
        parents: [headCommitSha],
      }),
    });

    if (!newCommitRes.ok) {
      return { success: false, error: "Failed to create commit" };
    }

    const newCommit = await newCommitRes.json();

    // Step 6: Update the branch reference to point to the new commit
    const updateRefRes = await fetch(
      `${ghApi}/repos/${repoFullName}/git/refs/heads/main`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommit.sha,
        }),
      }
    );

    if (!updateRefRes.ok) {
      return { success: false, error: "Failed to update branch reference" };
    }

    return {
      success: true,
      repoUrl: repo.html_url,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// =============================================================================
// Example Server Action: src/app/api/github/create-repo/route.ts
// =============================================================================

/*
import { auth } from "@/auth";
import { createPluginRepo } from "@/lib/github";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { repoName, description, files } = await request.json();

  const result = await createPluginRepo(
    session.accessToken,
    repoName,
    description,
    files
  );

  if (!result.success) {
    const status = result.error === "REPO_EXISTS" ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ repoUrl: result.repoUrl });
}
*/

// =============================================================================
// Example .env.local
// =============================================================================
// AUTH_SECRET=<generate with: npx auth secret>
// AUTH_GITHUB_ID=<from GitHub Developer Settings>
// AUTH_GITHUB_SECRET=<from GitHub Developer Settings>
