// pages/VerificationResult.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const VerificationResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    const emailParam = searchParams.get('email');
    const nameParam = searchParams.get('name');
    const roleParam = searchParams.get('role');
    const redirectParam = searchParams.get('redirect');

    if (emailParam) setEmail(emailParam);
    if (nameParam) setName(nameParam);
    if (roleParam) setRole(roleParam);

    if (statusParam === 'success') {
      setStatus('success');
      setMessage(messageParam || 'Email verified successfully!');
      
      // Auto redirect to login after countdown
      const redirectTo = redirectParam || '/login';
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate(redirectTo);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
      
    } else if (statusParam === 'already-verified') {
      setStatus('already-verified');
      setMessage(messageParam || 'This email is already verified.');
      
      // Auto redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
      
    } else if (statusParam === 'expired') {
      setStatus('expired');
      setMessage(messageParam || 'Your verification link has expired. Please request a new one.');
      
    } else if (errorParam) {
      setStatus('error');
      setMessage(messageParam || 'An error occurred during verification.');
      
    } else {
      setStatus('error');
      setMessage('Invalid verification link.');
    }
  }, [searchParams, navigate]);

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const handleResendVerification = () => {
    if (email) {
      navigate(`/resend-verification?email=${encodeURIComponent(email)}`);
    } else {
      navigate('/resend-verification');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Verifying your email...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-3xl font-bold text-green-600 mb-3">✓ Email Verified!</h2>
            
            {name && (
              <p className="text-lg text-gray-700 mb-2">
                Welcome, <span className="font-semibold">{name}</span>!
              </p>
            )}
            
            {email && (
              <p className="text-sm text-gray-500 mb-4">
                {email}
              </p>
            )}
            
            {role && (
              <p className="text-sm text-gray-500 mb-4">
                Account type: <span className="font-semibold capitalize">{role}</span>
              </p>
            )}
            
            <p className="text-gray-600 mb-6">
              {message || 'Your email has been verified successfully! You can now login to your account.'}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleGoToLogin}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
              >
                Go to Login {countdown > 0 && `(${countdown}s)`}
              </button>
              
              <p className="text-sm text-gray-400">
                Redirecting automatically in {countdown} seconds...
              </p>
            </div>
          </div>
        );

      case 'already-verified':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-yellow-600 mb-3">Already Verified</h2>
            
            <p className="text-gray-600 mb-6">{message}</p>
            
            <button
              onClick={handleGoToLogin}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
            >
              Go to Login
            </button>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-red-600 mb-3">Link Expired</h2>
            
            <p className="text-gray-600 mb-6">{message}</p>
            
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                className="w-full bg-[#1a1a2e] text-[#e8c547] px-6 py-3 rounded-lg hover:opacity-90 transition-colors text-lg font-semibold"
              >
                Request New Link
              </button>
              
              <button
                onClick={handleGoToLogin}
                className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-red-600 mb-3">Verification Failed</h2>
            
            <p className="text-gray-600 mb-6">{message || 'An error occurred during verification.'}</p>
            
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                className="w-full bg-[#1a1a2e] text-[#e8c547] px-6 py-3 rounded-lg hover:opacity-90 transition-colors text-lg font-semibold"
              >
                Request New Link
              </button>
              
              <button
                onClick={handleGoToLogin}
                className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">
            <span className="font-arabic">مر</span>
            <span className="font-bold text-[#e8c547]">حبا</span>
            {' '}
            <span className="text-gray-400">|</span>
            {' '}
            <span className="text-gray-600">Verification</span>
          </h1>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
};

export default VerificationResult;