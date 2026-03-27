import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Credenciais inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-blackBg flex items-center justify-center p-4">
      <div className="bg-gray900 p-8 rounded-xl border border-gray800 w-full max-w-md">
        <h1 className="text-3xl font-bold text-neonBlue mb-6 text-center">Admin Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray800 border border-gray700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neonBlue text-white"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray800 border border-gray700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neonBlue text-white"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-neonBlue text-blackBg py-3 rounded-lg font-bold hover:bg-cyan-300 transition-colors"
          >
            Entrar
          </button>
          <p className="text-center text-gray-400 mt-4">
            Não tem conta? <Link to="/register" className="text-neonBlue hover:underline">Cadastre-se</Link>
          </p>
        </form>
      </div>
    </div>
  );
}