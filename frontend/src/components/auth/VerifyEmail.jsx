/**
 * Verify Email Component
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, MailCheck } from 'lucide-react';
import { authAPI } from '../../services/api/auth';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setSuccess(false);
        setMessage('Missing verification token.');
        setLoading(false);
        return;
      }

      try {
        const response = await authAPI.verifyEmail(token);
        setSuccess(true);
        setMessage(response.message || 'Email verified successfully. You can now log in.');
      } catch (error) {
        setSuccess(false);
        setMessage(error.response?.data?.error || 'Verification failed. This link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-fade-in">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg ${
              success ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {success ? <CheckCircle size={32} className="text-white" /> : <AlertCircle size={32} className="text-white" />}
          </div>
          <h1 className="text-4xl font-bold text-primary-900 mb-2">
            {success ? 'Email Verified' : 'Verification Failed'}
          </h1>
          <p className="text-gray-600">{message}</p>
        </div>

        <div className="card bg-white shadow-2xl border border-gray-100">
          <div className="text-center space-y-4">
            {success ? (
              <>
                <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                  <MailCheck size={16} />
                  Your account is now verified.
                </div>
                <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2">
                  Go to Login
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Please go to signup and request a new verification email.
                </p>
                <Link to="/signup" className="btn-primary w-full">
                  Back to Signup
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
