import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import PrivateRoute from './routes/PrivateRoute';

// Rotas públicas (importadas normalmente, são leves)
import Login from './pages/public/Login/Login';
import Register from './pages/public/Register/Register';

// Lazy load das rotas privadas
const Home = lazy(() => import('./pages/private/Home/Home'));
const Clientes = lazy(() => import('./pages/private/Clientes/Clientes'));
const NovoCliente = lazy(() => import('./pages/private/Clientes/NovoCliente'));
const DetalhesCliente = lazy(() => import('./pages/private/Clientes/DetalhesCliente'));

const Orcamentos = lazy(() => import('./pages/private/Orcamentos/Orcamentos'));
const NovoOrcamento = lazy(() => import('./pages/private/Orcamentos/NovoOrcamento'));
// DetalhesOrcamento é exportado como { DetalhesOrcamento }
const DetalhesOrcamento = lazy(() =>
  import('./pages/private/Orcamentos/DetalhesOrcamento').then(module => ({
    default: module.DetalhesOrcamento,
  }))
);

const Faturas = lazy(() => import('./pages/private/Faturas/Faturas'));
const NovaFatura = lazy(() => import('./pages/private/Faturas/NovaFatura'));
// DetalhesFatura é exportado como { DetalhesFatura }
const DetalhesFatura = lazy(() =>
  import('./pages/private/Faturas/DetalhesFatura').then(module => ({
    default: module.DetalhesFatura,
  }))
);

const Agendamento = lazy(() => import('./pages/private/Agenda/Agendamento'));
const VerAgendamento = lazy(() => import('./pages/private/Agenda/VerAgendamento'));
const EditarAgendamento = lazy(() => import('./pages/private/Agenda/EditarAgendamento'));

const Notificacoes = lazy(() => import('./pages/private/Notificacoes/Notificacoes'));
const OficinaConfig = lazy(() => import('./pages/private/Configuracoes/Oficina'));
const FAQ = lazy(() => import('./pages/private/FAQ/FAQ'));
const Configuracoes = lazy(() => import('./pages/private/Configuracoes/Configuracoes'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
      <p className="mt-4 text-gray-600">Carregando...</p>
    </div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rotas privadas */}
          <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/notificacoes" element={<PrivateRoute><Notificacoes /></PrivateRoute>} />

          {/* Clientes */}
          <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>} />
          <Route path="/clientes/novo" element={<PrivateRoute><NovoCliente /></PrivateRoute>} />
          <Route path="/clientes/editar/:id" element={<PrivateRoute><NovoCliente /></PrivateRoute>} />
          <Route path="/clientes/ver/:id" element={<PrivateRoute><DetalhesCliente /></PrivateRoute>} />

          {/* Agenda */}
          <Route path="/agendamento/novo/:clienteId" element={<PrivateRoute><Agendamento /></PrivateRoute>} />
          <Route path="/agendamento/ver/:id" element={<PrivateRoute><VerAgendamento /></PrivateRoute>} />
          <Route path="/agendamento/editar/:id" element={<PrivateRoute><EditarAgendamento /></PrivateRoute>} />

          {/* Orçamentos */}
          <Route path="/orcamentos" element={<PrivateRoute><Orcamentos /></PrivateRoute>} />
          <Route path="/orcamentos/novo" element={<PrivateRoute><NovoOrcamento /></PrivateRoute>} />
          <Route path="/orcamentos/editar/:id" element={<PrivateRoute><NovoOrcamento /></PrivateRoute>} />
          <Route path="/orcamentos/detalhes/:id" element={<PrivateRoute><DetalhesOrcamento /></PrivateRoute>} />

          {/* Faturas */}
          <Route path="/faturas" element={<PrivateRoute><Faturas /></PrivateRoute>} />
          <Route path="/faturas/nova" element={<PrivateRoute><NovaFatura /></PrivateRoute>} />
          <Route path="/faturas/editar/:id" element={<PrivateRoute><NovaFatura /></PrivateRoute>} />
          <Route path="/faturas/detalhes/:id" element={<PrivateRoute><DetalhesFatura /></PrivateRoute>} />

          {/* FAQ e Configurações */}
          <Route path="/faq" element={<PrivateRoute><FAQ /></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
          <Route path="/oficina/config" element={<PrivateRoute><OficinaConfig /></PrivateRoute>} />

          {/* Rota curinga */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}