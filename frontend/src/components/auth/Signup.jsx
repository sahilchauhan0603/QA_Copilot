/**
 * Signup Component
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  MailCheck,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore";
import { authAPI } from "../../services/api/auth";
import { supabase, isSupabaseConfigured } from "../../services/supabaseClient";

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const getPasswordValidationError = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (/\s/.test(password)) return "Password must not contain spaces";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/\d/.test(password)) return "Password must contain at least one digit";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least one special character";
  return "";
};

const Signup = () => {
  const navigate = useNavigate();
  const { signup, googleLogin, isLoading } = useAuthStore();
  const [resendLoading, setResendLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [googleProfile, setGoogleProfile] = useState({ email: '', fullName: '' });
  const [oauthToken, setOauthToken] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });

  const [validationError, setValidationError] = useState("");
  const [availability, setAvailability] = useState({
    email: { available: null, checking: false },
    username: { available: null, checking: false },
  });

  // Debounced availability check
  const checkAvailability = useCallback(async (field, value) => {
    // Trim whitespace for validation
    const trimmedValue = value.trim();

    if (!trimmedValue || trimmedValue.length < 3) {
      setAvailability((prev) => ({
        ...prev,
        [field]: { available: null, checking: false },
      }));
      return;
    }

    setAvailability((prev) => ({
      ...prev,
      [field]: { ...prev[field], checking: true },
    }));

    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const response = await fetch(`${API_URL}/auth/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: trimmedValue }),
      });

      const data = await response.json();

      setAvailability((prev) => ({
        ...prev,
        [field]: {
          available: data[`${field}_available`],
          checking: false,
        },
      }));
    } catch (error) {
      console.error(`Error checking ${field} availability:`, error);
      setAvailability((prev) => ({
        ...prev,
        [field]: { available: null, checking: false },
      }));
    }
  }, []);

  // Debounce timer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email) {
        checkAvailability("email", formData.email);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.email, checkAvailability]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.username) {
        checkAvailability("username", formData.username);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, checkAvailability]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    // Validate email format
    if (!EMAIL_PATTERN.test(formData.email.trim().toLowerCase())) {
      setValidationError("Please enter a valid email address");
      toast.error("Please enter a valid email address");
      return;
    }

    // Check availability before proceeding
    if (availability.email.available === false) {
      setValidationError("Email is already registered");
      toast.error("Email is already registered");
      return;
    }

    if (availability.username.available === false) {
      setValidationError("Username is already taken");
      toast.error("Username is already taken");
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setValidationError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    // Validate password strength
    const passwordError = getPasswordValidationError(formData.password);
    if (passwordError) {
      setValidationError(passwordError);
      toast.error(passwordError);
      return;
    }

    const result = await signup(
      formData.email.trim().toLowerCase(),
      formData.username.trim().toLowerCase(),
      formData.password,
      formData.fullName.trim(),
    );

    if (result.success) {
      setSignupEmail(formData.email.trim().toLowerCase());
      setSignupComplete(true);
    } else {
      // Clear passwords on failed signup for security
      setFormData({
        ...formData,
        password: "",
        confirmPassword: "",
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Auto-trim email and username, prevent spaces in username
    let processedValue = value;
    if (name === "email") {
      processedValue = value.trim().toLowerCase();
    } else if (name === "username") {
      // Remove all spaces and force lowercase username
      processedValue = value.replace(/\s/g, "").toLowerCase();
    }

    setFormData({
      ...formData,
      [name]: processedValue,
    });
    setValidationError("");
  };

  // One-shot guard — prevents double-fire from getSession + onAuthStateChange
  const oauthHandled = useRef(false);

  // ── Google OAuth ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handleOAuthCallback = async (session) => {
      if (!session) return;
      if (oauthHandled.current) return;   // already handled
      oauthHandled.current = true;
      // Clear OAuth params from URL so back-navigation doesn't re-trigger
      window.history.replaceState({}, document.title, window.location.pathname);
      setGoogleLoading(true);
      try {
        const result = await googleLogin(session.access_token);
        if (result.success) {
          navigate('/dashboard');
        } else if (result.needsUsername) {
          setGoogleProfile({ email: result.email, fullName: result.fullName || '' });
          setOauthToken(session.access_token);
          setNewUsername(
            (result.fullName || result.email.split('@')[0])
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_')
              .slice(0, 30)
          );
          setShowUsernameForm(true);
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    // Only trigger if we're actually returning from an OAuth redirect
    // AND we were the ones who started the flow (sessionStorage flag)
    const initiated = sessionStorage.getItem('google_oauth_initiated');
    const isOAuthRedirect =
      window.location.hash.includes('access_token') ||
      new URLSearchParams(window.location.search).has('code');

    if (!initiated || !isOAuthRedirect) {
      // Clean up stale flag (e.g. user pressed back without completing auth)
      sessionStorage.removeItem('google_oauth_initiated');
      return;
    }

    sessionStorage.removeItem('google_oauth_initiated');
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleOAuthCallback(session);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) return;
    setGoogleLoading(true);
    try {
      sessionStorage.setItem('google_oauth_initiated', '1');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/signup',
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
    } catch {
      sessionStorage.removeItem('google_oauth_initiated');
      setGoogleLoading(false);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setUsernameError('');
    const trimmed = newUsername.trim();
    if (!trimmed) { setUsernameError('Username is required'); return; }
    if (trimmed.length < 3) { setUsernameError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await googleLogin(oauthToken, trimmed);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setUsernameError(result.error || 'Failed to create account');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signupEmail) return;

    setResendLoading(true);
    try {
      const response = await authAPI.resendVerification(signupEmail);
      toast.success(response.message || "Verification email sent");
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to resend verification email",
      );
    } finally {
      setResendLoading(false);
    }
  };

  if (signupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4 shadow-lg">
              <MailCheck size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-primary-900 mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-600">
              We sent a verification link to <strong>{signupEmail}</strong>
            </p>
          </div>

          <div className="card bg-white shadow-2xl border border-gray-100">
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Open your inbox and click the verification link. After that, you
                can log in.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? "Sending..." : "Resend verification email"}
              </button>
              <Link to="/login" className="btn-primary w-full block">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        {/* <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <UserPlus size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-primary-900 mb-2">
            QA Copilot
          </h1>
          <p className="text-gray-600">
            Create your account to get started
          </p>
        </div> */}

        <div className="card bg-white shadow-2xl border border-gray-100">
          {/* <div className="mb-6 items-center text-center">
            <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
            <p className="text-sm text-gray-500 mt-1">Fill in your details to get started</p>
          </div> */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
              <img src="/logo.png" alt="QA Copilot" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-bold text-primary-900 mb-2">
              QA Copilot
            </h1>
            <p className="text-gray-600">Create your account to get started</p>
          </div>

          {/* ── Google sign-up button ── */}
          {isSupabaseConfigured && !showUsernameForm && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mb-5"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                    </g>
                  </svg>
                )}
                Continue with Google
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR SIGN UP WITH EMAIL</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

          {/* ── Username collection (after Google OAuth for new users) ── */}
          {showUsernameForm && (
            <div className="animate-fade-in mb-4">
              <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                <p className="font-medium">Almost there!</p>
                <p className="text-xs text-blue-600 mt-0.5">Signed in as <strong>{googleProfile.email}</strong></p>
                {googleProfile.fullName && (
                  <p className="text-xs text-blue-600">Name: {googleProfile.fullName}</p>
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
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="input pl-9"
                      placeholder="e.g. john_doe"
                      maxLength={30}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Letters, numbers, and underscores only.</p>
                  {usernameError && (
                    <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={googleLoading || !newUsername.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating account...</>
                  ) : 'Create Account'}
                </button>
              </form>
            </div>
          )}

          {!showUsernameForm && <form onSubmit={handleSubmit} className="space-y-4">
            {validationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <span className="text-red-600">⚠</span>
                <span>{validationError}</span>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="input-label">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="input"
                placeholder="Enter your full name"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="email" className="input-label">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input pr-10 ${
                    availability.email.available === false
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : availability.email.available === true
                        ? "border-green-300 focus:border-green-500 focus:ring-green-500"
                        : ""
                  }`}
                  placeholder="you@example.com"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {availability.email.checking && (
                    <Loader2 size={18} className="text-gray-400 animate-spin" />
                  )}
                  {!availability.email.checking &&
                    availability.email.available === true && (
                      <CheckCircle size={18} className="text-green-500" />
                    )}
                  {!availability.email.checking &&
                    availability.email.available === false && (
                      <XCircle size={18} className="text-red-500" />
                    )}
                </div>
              </div>
              {availability.email.available === false && (
                <p className="mt-1 text-sm text-red-600">
                  This email is already registered
                </p>
              )}
              {availability.email.available === true && (
                <p className="mt-1 text-sm text-green-600">
                  Email is available
                </p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="input-label">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`input pr-10 ${
                    availability.username.available === false
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : availability.username.available === true
                        ? "border-green-300 focus:border-green-500 focus:ring-green-500"
                        : ""
                  }`}
                  placeholder="Only lowercase letters, numbers, and underscores"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {availability.username.checking && (
                    <Loader2 size={18} className="text-gray-400 animate-spin" />
                  )}
                  {!availability.username.checking &&
                    availability.username.available === true && (
                      <CheckCircle size={18} className="text-green-500" />
                    )}
                  {!availability.username.checking &&
                    availability.username.available === false && (
                      <XCircle size={18} className="text-red-500" />
                    )}
                </div>
              </div>
              {availability.username.available === false && (
                <p className="mt-1 text-sm text-red-600">
                  This username is already taken
                </p>
              )}
              {availability.username.available === true && (
                <p className="mt-1 text-sm text-green-600">
                  Username is available
                </p>
              )}
              {!availability.username.available &&
                !availability.username.checking && (
                  <p className="input-hint">
                    No spaces allowed (automatically removed)
                  </p>
                )}
            </div>

            <div>
              <label htmlFor="password" className="input-label">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input pr-11"
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="input-hint">
                Min 8 chars with uppercase, lowercase, digit, and special
                character
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="input-label">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input pr-11"
                  placeholder="Re-enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isLoading ||
                availability.email.checking ||
                availability.username.checking ||
                availability.email.available === false ||
                availability.username.available === false
              }
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>}

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;








