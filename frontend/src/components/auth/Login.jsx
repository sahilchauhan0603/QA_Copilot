/**
 * Login Component
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Users, Activity, UsersRound, ListChecks, Zap } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { API_BASE_URL } from '../../services/api/client';

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

function StatCard({ icon: Icon, label, value, color, animateStart }) {
  const count = useCountUp(value, 1400, animateStart);
  return (
    <div className="flex flex-col items-center gap-1.5 w-full px-3 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
      <Icon size={18} className={color} />
      <span className="text-xl font-bold text-white tabular-nums leading-none">
        {value > 0 ? count.toLocaleString() : '—'}
      </span>
      <span className="text-[10px] text-blue-100 text-center leading-tight">{label}</span>
    </div>
  );
}

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.username.trim().toLowerCase(), formData.password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setFormData({
        ...formData,
        password: '',
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    let processedValue = value;
    if (name === 'username') {
      processedValue = value.trim().toLowerCase();
    }

    setFormData({
      ...formData,
      [name]: processedValue,
    });
  };

  return (
    <>
      {/* ── Fixed right-side stats panel ── */}
      <div className="fixed right-0 top-0 h-screen w-30 flex flex-col items-center justify-center gap-3 px-3 py-8 bg-gradient-to-b from-primary-700 via-primary-800 to-blue-900 border-l border-white/10 shadow-2xl z-20 animate-fade-in">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300 text-center mb-1">
          Live Stats
        </p>
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.total_users}
          color="text-blue-300"
          animateStart={statsLoaded}
        />
        <StatCard
          icon={Zap}
          label="Online Today"
          value={stats.active_users_today}
          color="text-pink-300"
          animateStart={statsLoaded}
        />
        <StatCard
          icon={Activity}
          label="Active (30 days)"
          value={stats.active_users_30d}
          color="text-green-300"
          animateStart={statsLoaded}
        />
        <StatCard
          icon={UsersRound}
          label="Teams"
          value={stats.total_teams}
          color="text-purple-300"
          animateStart={statsLoaded}
        />
        <StatCard
          icon={ListChecks}
          label="Test Runs"
          value={stats.total_generations}
          color="text-yellow-300"
          animateStart={statsLoaded}
        />
      </div>

      {/* ── Login page ── */}
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4 pr-40">
        <div className="max-w-md w-full">
        <div className="card bg-white shadow-2xl border border-gray-100">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <LogIn size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-primary-900 mb-2">
              QA Copilot
            </h1>
            <p className="text-gray-600">
              Enter your credentials to access your account
            </p>
          </div>

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
                  type={showPassword ? 'text' : 'password'}
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
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

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
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
