const API_BASE = '/ai-team-builder/api';

export function getGitHubToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('github_token');
}

export function setGitHubToken(token: string): void {
  localStorage.setItem('github_token', token);
}

export function clearGitHubToken(): void {
  localStorage.removeItem('github_token');
}

export function startGitHubAuth(): void {
  window.location.href = `${window.location.origin}${API_BASE}/auth/github`;
}

export function isAuthenticated(): boolean {
  return !!getGitHubToken();
}
