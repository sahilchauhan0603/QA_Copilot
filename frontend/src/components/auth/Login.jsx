/**
 * Login Component
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  LogIn,
  Eye,
  EyeOff,
  Users,
  Activity,
  UsersRound,
  ListChecks,
  Zap,
  User,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import { API_BASE_URL } from "../../services/api/client";
import { supabase, isSupabaseConfigured } from "../../services/supabaseClient";

// Animated counter hook
function useCountUp(target, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start || target === 0) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  animateStart,
  compact = false,
}) {
  const count = useCountUp(value, 1400, animateStart);
  return (
    <div
      className={`flex flex-col items-center w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 ${
        compact ? "gap-0.5 px-2 py-1.5" : "gap-1.5 px-3 py-3.5"
      }`}
    >
      <Icon size={compact ? 13 : 18} className={color} />
      <span
        className={`font-bold text-white tabular-nums leading-none ${compact ? "text-sm" : "text-xl"}`}
      >
        {value > 0 ? count.toLocaleString() : "—"}
      </span>
      <span
        className={`text-blue-100 text-center leading-tight ${compact ? "text-[8px]" : "text-[10px]"}`}
      >
        {label}
      </span>
    </div>
  );
}

const Login = () => {
  const navigate = useNavigate();
  const { login, googleLogin, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  // Detect if this window is the OAuth popup callback (evaluated once, before first paint)
  const [isPopupCallback] = useState(
    () =>
      window.opener != null &&
      window.opener !== window &&
      (window.location.hash.includes('access_token') ||
        new URLSearchParams(window.location.search).has('code')),
  );

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [googleProfile, setGoogleProfile] = useState({
    email: "",
    fullName: "",
  });
  const [oauthToken, setOauthToken] = useState(null);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // Platform stats
  const [stats, setStats] = useState({
    total_users: 0,
    active_users_30d: 0,
    total_teams: 0,
    total_generations: 0,
    active_users_today: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/stats`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setStatsLoaded(true);
      })
      .catch(() => setStatsLoaded(true));
  }, []);

  // One-shot guard — prevents double-fire from getSession + onAuthStateChange
  const oauthHandled = useRef(false);

  // Detect Supabase OAuth callback (Google redirect back to this page)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const isOAuthRedirect =
      window.location.hash.includes("access_token") ||
      new URLSearchParams(window.location.search).has("code");

    // ── Popup callback: relay session to opener window, then close ──
    if (window.opener && window.opener !== window && isOAuthRedirect) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        window.opener.postMessage(
          { type: "GOOGLE_OAUTH_RESULT", session: session || null },
          window.location.origin,
        );
        window.close();
      });
      return;
    }

    const handleOAuthCallback = async (session) => {
      if (!session) return;
      if (oauthHandled.current) return; // already handled
      oauthHandled.current = true;
      // Clear OAuth params from URL so back-navigation doesn't re-trigger
      window.history.replaceState({}, document.title, window.location.pathname);
      setGoogleLoading(true);
      try {
        const result = await googleLogin(session.access_token);
        if (result.success) {
          navigate("/dashboard");
        } else if (result.needsUsername) {
          // New user — ask for a username
          setGoogleProfile({
            email: result.email,
            fullName: result.fullName || "",
          });
          setOauthToken(session.access_token);
          setNewUsername(
            // Pre-populate with first part of email as a suggestion
            (result.fullName || result.email.split("@")[0])
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "_")
              .slice(0, 30),
          );
          setShowUsernameForm(true);
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    // Only trigger if we're actually returning from an OAuth redirect
    // AND we were the ones who started the flow (sessionStorage flag)
    const initiated = sessionStorage.getItem("google_oauth_initiated");

    if (!initiated || !isOAuthRedirect) {
      // Clean up stale flag (e.g. user pressed back without completing auth)
      sessionStorage.removeItem("google_oauth_initiated");
      return;
    }

    sessionStorage.removeItem("google_oauth_initiated");
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleOAuthCallback(session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(
      formData.username.trim().toLowerCase(),
      formData.password,
    );
    if (result.success) {
      navigate("/dashboard");
    } else {
      setFormData({
        ...formData,
        password: "",
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    let processedValue = value;
    if (name === "username") {
      processedValue = value.trim().toLowerCase();
    }

    setFormData({
      ...formData,
      [name]: processedValue,
    });
  };

  // ── Google OAuth ──
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      alert(
        "Google sign-in is not configured. Please contact the administrator.",
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/login",
          queryParams: { access_type: "offline", prompt: "select_account" },
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        setGoogleLoading(false);
        return;
      }

      // Open Google sign-in in a centered popup instead of redirecting
      const w = 500, h = 640;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
      const popup = window.open(
        data.url,
        "google-signin-popup",
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      );

      if (!popup) {
        // Popup blocked — fall back to full-page redirect
        sessionStorage.setItem("google_oauth_initiated", "1");
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin + "/login",
            queryParams: { access_type: "offline", prompt: "select_account" },
          },
        });
        return;
      }

      let pollInterval;
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        clearInterval(pollInterval);
      };

      const onMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "GOOGLE_OAUTH_RESULT") return;
        cleanup();
        const { session } = event.data;
        if (!session) {
          setGoogleLoading(false);
          return;
        }
        try {
          const result = await googleLogin(session.access_token);
          if (result.success) {
            navigate("/dashboard");
          } else if (result.needsUsername) {
            setGoogleProfile({
              email: result.email,
              fullName: result.fullName || "",
            });
            setOauthToken(session.access_token);
            setNewUsername(
              (result.fullName || result.email.split("@")[0])
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .slice(0, 30),
            );
            setShowUsernameForm(true);
          }
        } finally {
          setGoogleLoading(false);
        }
      };

      window.addEventListener("message", onMessage);

      // Detect if user manually closes the popup without completing sign-in
      pollInterval = setInterval(() => {
        if (popup.closed) {
          cleanup();
          setGoogleLoading(false);
        }
      }, 500);
    } catch {
      setGoogleLoading(false);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setUsernameError("");
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUsernameError("Username is required");
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameError("Only letters, numbers, and underscores allowed");
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await googleLogin(oauthToken, trimmed);
      if (result.success) {
        navigate("/dashboard");
      } else {
        setUsernameError(result.error || "Failed to create account");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const statItems = [
    {
      icon: Users,
      label: "Total Users",
      value: stats.total_users,
      color: "text-blue-300",
    },
    {
      icon: Zap,
      label: "Online Today",
      value: stats.active_users_today,
      color: "text-pink-300",
    },
    {
      icon: Activity,
      label: "Active (30d)",
      value: stats.active_users_30d,
      color: "text-green-300",
    },
    {
      icon: UsersRound,
      label: "Teams",
      value: stats.total_teams,
      color: "text-purple-300",
    },
    {
      icon: ListChecks,
      label: "Test Runs",
      value: stats.total_generations,
      color: "text-yellow-300",
    },
  ];

  // If running inside the OAuth popup, show a minimal loader while useEffect relays the session
  if (isPopupCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Completing sign-in…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: horizontal stats bar at top (hidden on lg+) ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-primary-700 via-primary-800 to-blue-900 border-b border-white/10 shadow-lg px-2 py-1.5 animate-fade-in">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300 text-center mb-1">
          Live Stats
        </p>
        <div className="flex gap-1.5">
          {statItems.map(({ icon, label, value, color }) => (
            <StatCard
              key={label}
              icon={icon}
              label={label}
              value={value}
              color={color}
              animateStart={statsLoaded}
              compact
            />
          ))}
        </div>
      </div>

      {/* ── Desktop: fixed right-side vertical stats panel (hidden below lg) ── */}
      <div className="hidden lg:flex fixed right-0 top-0 h-screen w-30 flex-col items-center justify-center gap-3 px-3 py-8 bg-gradient-to-b from-primary-700 via-primary-800 to-blue-900 border-l border-white/10 shadow-2xl z-20 animate-fade-in">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300 text-center mb-1">
          Live Stats
        </p>
        {statItems.map(({ icon, label, value, color }) => (
          <StatCard
            key={label}
            icon={icon}
            label={label}
            value={value}
            color={color}
            animateStart={statsLoaded}
          />
        ))}
      </div>

      {/* ── Login page ── */}
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4 pt-20 lg:pt-4 lg:pr-40">
        <div className="max-w-md w-full">
          <div className="card bg-white shadow-2xl border border-gray-100">
            <div className="text-center mb-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
                <img
                  src="/logo.png"
                  alt="QA Copilot"
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
              <h1 className="text-4xl font-bold text-primary-900 mb-2">
                QA Copilot
              </h1>
              <p className="text-gray-600">
                Enter your credentials to access your account
              </p>
            </div>

            {/* ── Username collection (after Google OAuth for new users) ── */}
            {showUsernameForm ? (
              <div className="animate-fade-in">
                <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                  <p className="font-medium">Almost there!</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Signed in as <strong>{googleProfile.email}</strong>
                  </p>
                  {googleProfile.fullName && (
                    <p className="text-xs text-blue-600">
                      Name: {googleProfile.fullName}
                    </p>
                  )}
                </div>
                <form onSubmit={handleUsernameSubmit} className="space-y-4">
                  <div>
                    <label className="input-label">Choose a username</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) =>
                          setNewUsername(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, ""),
                          )
                        }
                        className="input pl-9"
                        placeholder="e.g. john_doe"
                        maxLength={30}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Letters, numbers, and underscores only.
                    </p>
                    {usernameError && (
                      <p className="text-xs text-red-500 mt-1">
                        {usernameError}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={googleLoading || !newUsername.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="input-label">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="input"
                    placeholder="Enter your username or email"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="input-label">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input pr-11"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading && !googleLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {isLoading && !googleLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Logging in...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Login to Dashboard
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Divider ── */}
            {isSupabaseConfigured && !showUsernameForm && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* ── Google sign-in button ── */}
            {isSupabaseConfigured && !showUsernameForm && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path
                        fill="#4285F4"
                        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                      />
                      <path
                        fill="#34A853"
                        d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                      />
                    </g>
                  </svg>
                )}
                Continue with Google
              </button>
            )}

            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
