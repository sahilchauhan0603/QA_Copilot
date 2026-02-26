/**
 * Signup Component
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  MailCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore";
import { authAPI } from "../../services/api/auth";

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
  const { signup, isLoading } = useAuthStore();
  const [resendLoading, setResendLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");

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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <UserPlus size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-primary-900 mb-2">
              QA Copilot
            </h1>
            <p className="text-gray-600">Create your account to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="Create a strong password"
                required
              />
              <p className="input-hint">
                Min 8 chars with uppercase, lowercase, digit, and special
                character
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="input-label">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="Re-enter your password"
                required
              />
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
          </form>

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
