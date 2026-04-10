'use client';

import { useEffect, useState } from 'react';

export default function SharePage({ params }: any) {
  const { token } = params;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/share/${token}`)
      .then((res) => res.json())
      .then(setData);
  }, [token]);

  if (!data) {
    return <div style={{ padding: 40 }}>Carregando...</div>;
  }

  const doc = data.data;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        <h1 style={styles.title}>
          {data.type === 'ESTIMATE' ? 'Orçamento' : 'Fatura'}
        </h1>

        <p style={styles.status}>{doc.status}</p>

        <div style={styles.section}>
          <h3>Cliente</h3>
          <p>{doc.client.name}</p>
          <p>{doc.client.phone}</p>
        </div>

        <div style={styles.section}>
          <h3>Total</h3>
          <p style={styles.total}>
            R$ {Number(doc.total).toFixed(2)}
          </p>
        </div>

        <div style={styles.actions}>
          <a href={data.pdfUrl} target="_blank" style={styles.button}>
            📄 Baixar PDF
          </a>
        </div>

      </div>
    </div>
  );
}

const styles: any = {
  container: {
    padding: 40,
    background: '#f3f4f6',
    minHeight: '100vh',
  },
  card: {
    maxWidth: 600,
    margin: '0 auto',
    background: '#fff',
    padding: 30,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
  },
  status: {
    background: '#e0edff',
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: 20,
  },
  section: {
    marginTop: 20,
  },
  total: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  actions: {
    marginTop: 30,
  },
  button: {
    display: 'inline-block',
    padding: '12px 20px',
    background: '#2563eb',
    color: '#fff',
    borderRadius: 8,
    textDecoration: 'none',
  },
};