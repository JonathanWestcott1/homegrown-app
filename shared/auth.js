// shared/auth.js — session check, role enforcement, shared logout
// Requires: _sb (from shared/supabase.js)

/**
 * requireAuth(expectedRole)
 * Call from an async IIFE at page load.
 * Returns the session if auth is valid; redirects and returns null otherwise.
 * expectedRole: 'student' | 'employer'
 */
async function requireAuth(expectedRole) {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window.location.href = '/';
    return null;
  }
  const role = session.user.user_metadata?.user_type;
  if (expectedRole === 'student' && role === 'employer') {
    window.location.href = '/employer/dashboard.html';
    return null;
  }
  if (expectedRole === 'employer' && role === 'student') {
    window.location.href = '/student/dashboard.html';
    return null;
  }
  return session;
}

async function logout() {
  await _sb.auth.signOut();
  window.location.href = '/';
}
