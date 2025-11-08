// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  // form state
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [email, setEmail] = useState(''); // optional (either identifier or email/phone)
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, send straight to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) navigate('/', { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // basic validation
    if (!password) {
      setError('Password is required');
      return;
    }
    if (!identifier && !email && !phone) {
      setError('Enter email or phone (or use identifier field)');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        // send identifier if filled; backend accepts identifier/email/phone
        identifier: identifier || undefined,
        email: email || undefined,
        phone: phone || undefined,
        password,
      };

      const res = await fetch('https://maurya-electronics.vercel.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // backend returns { error: '...' } typically
        setError(json?.error || (json?.message || 'Login failed'));
        setLoading(false);
        return;
      }

      // expected: { success: true, token, expiresIn, user }
      const { token, user } = json;
      if (!token) {
        setError('No token returned from server');
        setLoading(false);
        return;
      }

      // store token & user
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user || {}));
        
      } catch (err) {
        // storage could fail in strict environments — ignore but warn
        console.warn('localStorage write failed', err);
      }

      // optionally remember toggles; if not remember, you could use sessionStorage
      if (!remember) {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user || {}));
      }
const role = user?.role;
if (role === 'employee') {
  // If employee, send to a simple add-complaint page
  navigate('/complaints/new', { replace: true });
} else {
  // admins and others -> full dashboard
  navigate('/', { replace: true });
}
      // redirect to dashboard
      
    } catch (err) {
      console.error('login error', err);
      setError('Network error, please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to access the Repair CRM dashboard</p>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Identifier (email or phone)</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or 9876543210"
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400 mt-1">Or fill Email or Phone individually below (optional)</div>
          </div>

         

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setIdentifier('');
                setEmail('');
                setPhone('');
                setPassword('');
                setError('');
              }}
              className="text-sm text-gray-600 hover:underline"
            >
              Clear
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          Need an account? Contact your administrator.
        </div>
      </div>
    </div>
  );
}
