import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAppointmentById } from '../../../services/appointments';
import { FiArrowLeft, FiClock, FiCalendar, FiFileText } from 'react-icons/fi';

const VerAgendamento: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: appointment,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => getAppointmentById(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loading}>Carregando agendamento...</div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.error}>Erro ao carregar agendamento. Tente novamente.</p>
        <button onClick={() => navigate('/agendamentos')} style={styles.backButton}>
          Voltar para lista
        </button>
      </div>
    );
  }

  const dateObj = new Date(appointment.date);
  const formattedDate = dateObj.toLocaleDateString('pt-BR');
  const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        <div style={styles.header}>
          <button onClick={() => navigate('/agendamentos')} style={styles.backIcon}>
            <FiArrowLeft size={24} />
          </button>
          <h1 style={styles.title}>Detalhes do Agendamento</h1>
        </div>

        <div style={styles.card}>
          <div style={styles.infoRow}>
            <FiCalendar size={20} style={styles.icon} />
            <div>
              <div style={styles.label}>Data</div>
              <div style={styles.value}>{formattedDate}</div>
            </div>
          </div>

          <div style={styles.infoRow}>
            <FiClock size={20} style={styles.icon} />
            <div>
              <div style={styles.label}>Horário</div>
              <div style={styles.value}>{formattedTime}</div>
            </div>
          </div>

          <div style={styles.infoRow}>
            <FiFileText size={20} style={styles.icon} />
            <div>
              <div style={styles.label}>Observações</div>
              <div style={styles.value}>{appointment.comment || 'Nenhuma observação'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    background: 'linear-gradient(145deg, #0a0a0a 0%, #000000 100%)',
    minHeight: '100vh',
    padding: '48px 24px',
    color: '#e0e0e0',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  innerContainer: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '40px',
  },
  backIcon: {
    background: '#1a1a1a',
    border: 'none',
    color: '#00e5ff',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    marginRight: '16px',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(0, 229, 255, 0.2)',
  },
  title: {
    fontSize: 'clamp(32px, 5vw, 48px)',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #00e5ff, #7fdbff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
  },
  card: {
    background: '#111',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #00e5ff20',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #2a2a2a',
  },
  icon: {
    color: '#00e5ff',
    marginTop: '4px',
  },
  label: {
    fontSize: '14px',
    color: '#a0a0a0',
    marginBottom: '8px',
  },
  value: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#fff',
  },
  loadingContainer: {
    background: 'linear-gradient(145deg, #0a0a0a 0%, #000000 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: '#00e5ff',
    fontSize: '18px',
  },
  errorContainer: {
    background: 'linear-gradient(145deg, #0a0a0a 0%, #000000 100%)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ff4444',
  },
  error: {
    fontSize: '18px',
    marginBottom: '20px',
  },
  backButton: {
    background: '#00e5ff',
    border: 'none',
    color: '#000',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default VerAgendamento;