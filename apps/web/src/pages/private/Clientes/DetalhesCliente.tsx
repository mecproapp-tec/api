import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiDollarSign, FiClock, FiEye, FiTrash2 } from "react-icons/fi";

import { getClientById, type Client, getVehicleDisplay } from "../../../services/clients";
import { getEstimates, type Estimate } from "../../../services/Estimates";
import { getInvoices, type Invoice } from "../../../services/invoices";
import { getAppointments, deleteAppointment, type Appointment } from "../../../services/appointments";

function calculateTotalWithIss(items?: Invoice["items"]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((acc, item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
    return acc + itemTotal + iss;
  }, 0);
}

export default function DetalhesCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Client | null>(null);
  const [orcamentos, setOrcamentos] = useState<Estimate[]>([]);
  const [faturas, setFaturas] = useState<Invoice[]>([]);
  const [agendamentos, setAgendamentos] = useState<Appointment[]>([]);
  const [observacoesInput, setObservacoesInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const clientId = Number(id);
    if (isNaN(clientId) || clientId <= 0) {
      setError("ID do cliente inválido");
      setLoading(false);
      return;
    }
    carregarDados(clientId);
  }, [id]);

  const carregarDados = async (clientId: number) => {
    setLoading(true);
    setError("");
    try {
      const clienteData = await getClientById(clientId);
      setCliente(clienteData);

      const estimatesData = await getEstimates();
      setOrcamentos(estimatesData.filter(e => e.clientId === clientId));

      const invoicesData = await getInvoices();
      setFaturas(invoicesData.filter(i => i.clientId === clientId));

      const appointmentsData = await getAppointments();
      setAgendamentos(appointmentsData.filter(a => a.clientId === clientId));

      const obs = localStorage.getItem(`cliente_obs_${clientId}`);
      setObservacoesInput(obs || "");
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(err.response?.data?.message || "Erro ao carregar dados do cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgendamento = async (agendamentoId: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    try {
      await deleteAppointment(agendamentoId);
      setAgendamentos(prev => prev.filter(a => a.id !== agendamentoId));
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao excluir agendamento");
    }
  };

  const handleSaveObservacoes = () => {
    if (!cliente) return;
    localStorage.setItem(`cliente_obs_${cliente.id}`, observacoesInput);
    alert("Observações salvas com sucesso!");
  };

  const handlePDFOrcamento = (orcamento: Estimate) => {
    const oficina = JSON.parse(localStorage.getItem("oficina") || "{}");
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Orçamento ${orcamento.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #00e5ff; padding-bottom: 20px; }
            .logo { max-width: 100px; max-height: 80px; object-fit: contain; }
            .info { flex: 1; }
            .info h2 { margin: 0 0 5px; color: #333; }
            .info p { margin: 3px 0; color: #666; }
            .details { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .valor { text-align: right; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .total-geral { font-size: 1.2rem; font-weight: bold; margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            ${oficina.logo ? `<img src="${oficina.logo}" class="logo" />` : ""}
            <div class="info">
              <h2>${oficina.nome || "Oficina"}</h2>
              <p>${oficina.tipoDocumento || ""} ${oficina.documento || ""}</p>
              <p>${oficina.endereco || ""}, ${oficina.numero || ""}</p>
              <p>Tel: ${oficina.telefone || ""} | Email: ${oficina.email || ""}</p>
            </div>
          </div>
          <h1>Orçamento</h1>
          <p><strong>Cliente:</strong> ${cliente?.name || "Cliente não encontrado"}</p>
          <p><strong>Veículo:</strong> ${cliente ? getVehicleDisplay(cliente) : "Não informado"}</p>
          <p><strong>Placa:</strong> ${cliente?.plate || ""}</p>
          <p><strong>Data:</strong> ${new Date(orcamento.date).toLocaleDateString("pt-BR")}</p>
          <p><strong>Status:</strong> ${
            orcamento.status === "pending" ? "Pendente" :
            orcamento.status === "accepted" ? "Aceito" :
            "Convertido"
          }</p>
          <div class="details">
            <h3>Itens</h3>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th class="valor">Valor (R$)</th>
                  <th class="valor">ISS (%)</th>
                  <th class="valor">Total c/ ISS (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${orcamento.items.map(item => {
                  const itemTotal = item.price * (item.quantity || 1);
                  const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
                  return `
                    <tr>
                      <td>${item.description}</td>
                      <td class="valor">${itemTotal.toFixed(2)}</td>
                      <td class="valor">${item.issPercent ? item.issPercent + '%' : '-'}</td>
                      <td class="valor">${(itemTotal + iss).toFixed(2)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;"><strong>Total Geral</strong></td>
                  <td class="valor"><strong>${orcamento.total.toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="total-geral">
            <strong>Total: R$ ${orcamento.total.toFixed(2)}</strong>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const handlePDFFatura = (fatura: Invoice) => {
    const oficina = JSON.parse(localStorage.getItem("oficina") || "{}");
    const totalComIss = calculateTotalWithIss(fatura.items);
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Fatura ${fatura.number || fatura.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #00e5ff; padding-bottom: 20px; }
            .logo { max-width: 100px; max-height: 80px; object-fit: contain; }
            .info { flex: 1; }
            .info h2 { margin: 0 0 5px; color: #333; }
            .info p { margin: 3px 0; color: #666; }
            .details { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .valor { text-align: right; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .total-geral { font-size: 1.2rem; font-weight: bold; margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            ${oficina.logo ? `<img src="${oficina.logo}" class="logo" />` : ""}
            <div class="info">
              <h2>${oficina.nome || "Oficina"}</h2>
              <p>${oficina.tipoDocumento || ""} ${oficina.documento || ""}</p>
              <p>${oficina.endereco || ""}, ${oficina.numero || ""}</p>
              <p>Tel: ${oficina.telefone || ""} | Email: ${oficina.email || ""}</p>
            </div>
          </div>
          <h1>Fatura</h1>
          <p><strong>Cliente:</strong> ${cliente?.name || "Cliente não encontrado"}</p>
          <p><strong>Veículo:</strong> ${cliente ? getVehicleDisplay(cliente) : "Não informado"}</p>
          <p><strong>Placa:</strong> ${cliente?.plate || ""}</p>
          <p><strong>Data:</strong> ${new Date(fatura.createdAt).toLocaleDateString("pt-BR")}</p>
          <p><strong>Status:</strong> ${
            fatura.status === "PAID" ? "Paga" :
            fatura.status === "PENDING" ? "Pendente" :
            "Cancelada"
          }</p>
          <div class="details">
            <h3>Itens</h3>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th class="valor">Qtd</th>
                  <th class="valor">Preço Unit.</th>
                  <th class="valor">ISS (%)</th>
                  <th class="valor">Total c/ ISS</th>
                </tr>
              </thead>
              <tbody>
                ${fatura.items.map(item => {
                  const itemTotal = (item.price || 0) * (item.quantity || 1);
                  const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
                  const totalItem = itemTotal + iss;
                  return `
                    <tr>
                      <td>${item.description}</td>
                      <td class="valor">${item.quantity || 1}</td>
                      <td class="valor">${(item.price || 0).toFixed(2)}</td>
                      <td class="valor">${item.issPercent ? item.issPercent + '%' : '-'}</td>
                      <td class="valor">${totalItem.toFixed(2)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="4" style="text-align: right;"><strong>Total Geral</strong></td>
                  <td class="valor"><strong>${totalComIss.toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="total-geral">
            <strong>Total: R$ ${totalComIss.toFixed(2)}</strong>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    let color = "#ffaa00";
    let label = status;
    if (status === "PAID") { color = "#00ff88"; label = "Pago"; }
    else if (status === "converted") { color = "#00ff88"; label = "Convertido"; }
    else if (status === "accepted") { color = "#00e5ff"; label = "Aceito"; }
    else if (status === "PENDING") { color = "#ffaa00"; label = "Pendente"; }
    else if (status === "CANCELED") { color = "#ff4444"; label = "Cancelado"; }
    return (
      <span
        style={{
          background: "#1a1a1a",
          color,
          padding: "6px 12px",
          borderRadius: "100px",
          fontWeight: "600",
          fontSize: "0.85rem",
          display: "inline-block",
          border: `1px solid ${color}40`,
        }}
      >
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loading}>Carregando...</div>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div style={styles.errorContainer}>
        <p style={{ fontSize: "1.2rem", opacity: 0.7 }}>{error || "Cliente não encontrado"}</p>
        <button
          onClick={() => navigate("/clientes")}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            background: "#00e5ff",
            border: "none",
            borderRadius: "8px",
            color: "#000",
            cursor: "pointer",
          }}
        >
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <button onClick={() => navigate("/clientes")} style={styles.backButton}>
            <FiArrowLeft size={24} />
          </button>
          <h1 style={styles.title}>Detalhes do Cliente</h1>
        </div>

        {/* Card do cliente */}
        <div style={styles.card}>
          <h2 style={styles.clientName}>{cliente.name}</h2>
          <div style={styles.infoGrid}>
            <div>
              <span style={styles.label}>Telefone</span>
              <span style={styles.value}>{cliente.phone}</span>
            </div>
            <div>
              <span style={styles.label}>Veículo</span>
              <span style={styles.value}>{getVehicleDisplay(cliente)}</span>
            </div>
            <div>
              <span style={styles.label}>Placa</span>
              <span style={styles.value}>{cliente.plate || "Não informado"}</span>
            </div>
          </div>

          {/* Observações */}
          <div style={styles.observations}>
            <label style={styles.label}>Observações sobre o cliente</label>
            <textarea
              value={observacoesInput}
              onChange={(e) => setObservacoesInput(e.target.value)}
              style={styles.textarea}
              rows={4}
              placeholder="Adicione anotações sobre o cliente aqui..."
            />
            <button onClick={handleSaveObservacoes} style={styles.saveButton}>
              Salvar Observações
            </button>
          </div>
        </div>

        {/* Seções de histórico */}
        <div style={styles.sections}>
          {/* Orçamentos */}
          <section>
            <h3 style={styles.sectionTitle}>
              <FiFileText style={styles.icon} /> Orçamentos ({orcamentos.length})
            </h3>
            {orcamentos.length > 0 ? (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orcamentos.map((orc, idx) => (
                      <tr key={orc.id} style={{ background: idx % 2 === 0 ? "#0f0f0f" : "#1a1a1a" }}>
                        <td>{formatDate(orc.date)}</td>
                        <td style={{ color: "#00e5ff", fontWeight: "600" }}>R$ {orc.total.toFixed(2)}</td>
                        <td>{getStatusBadge(orc.status)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => handlePDFOrcamento(orc)} style={styles.actionButton} title="Visualizar orçamento">
                            <FiEye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyMessage}>Nenhum orçamento encontrado.</div>
            )}
          </section>

          {/* Faturas */}
          <section>
            <h3 style={styles.sectionTitle}>
              <FiDollarSign style={styles.icon} /> Faturas ({faturas.length})
            </h3>
            {faturas.length > 0 ? (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Número</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturas.map((fat, idx) => (
                      <tr key={fat.id} style={{ background: idx % 2 === 0 ? "#0f0f0f" : "#1a1a1a" }}>
                        <td>{formatDate(fat.createdAt)}</td>
                        <td>{fat.number}</td>
                        <td style={{ color: "#00e5ff", fontWeight: "600" }}>R$ {fat.total.toFixed(2)}</td>
                        <td>{getStatusBadge(fat.status)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => handlePDFFatura(fat)} style={styles.actionButton} title="Visualizar fatura">
                            <FiEye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyMessage}>Nenhuma fatura encontrada.</div>
            )}
          </section>

          {/* Agendamentos */}
          <section>
            <h3 style={styles.sectionTitle}>
              <FiClock style={styles.icon} /> Agendamentos ({agendamentos.length})
            </h3>
            {agendamentos.length > 0 ? (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Hora</th>
                      <th>Observações</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentos.map((agd, idx) => {
                      const data = new Date(agd.date);
                      const dataStr = data.toLocaleDateString("pt-BR");
                      const horaStr = data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={agd.id} style={{ background: idx % 2 === 0 ? "#0f0f0f" : "#1a1a1a" }}>
                          <td>{dataStr}</td>
                          <td>{horaStr}</td>
                          <td style={{ color: "#b0b0b0" }}>{agd.comment || "-"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button onClick={() => handleDeleteAgendamento(agd.id)} style={{ ...styles.actionButton, color: "#ff5555", borderColor: "#ff555530" }} title="Excluir">
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyMessage}>Nenhum agendamento encontrado.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "linear-gradient(145deg, #0a0a0a 0%, #000000 100%)",
    minHeight: "100vh",
    padding: "48px 24px",
    color: "#e0e0e0",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    marginBottom: "40px",
  },
  backButton: {
    background: "#1a1a1a",
    border: "none",
    color: "#00e5ff",
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginRight: "16px",
    transition: "all 0.2s",
    boxShadow: "0 4px 12px rgba(0, 229, 255, 0.2)",
  },
  title: {
    fontSize: "clamp(32px, 5vw, 48px)",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00e5ff, #7fdbff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  },
  card: {
    background: "#111",
    borderRadius: "24px",
    padding: "32px",
    marginBottom: "40px",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #00e5ff20",
  },
  clientName: {
    fontSize: "32px",
    marginBottom: "24px",
    color: "#fff",
    borderBottom: "2px solid #00e5ff30",
    paddingBottom: "16px",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
  },
  label: {
    color: "#a0a0a0",
    display: "block",
    fontSize: "0.9rem",
    marginBottom: "4px",
  },
  value: {
    fontSize: "1.2rem",
    color: "#fff",
  },
  observations: {
    marginTop: "32px",
    borderTop: "1px solid #00e5ff30",
    paddingTop: "24px",
  },
  textarea: {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #00e5ff30",
    borderRadius: "8px",
    padding: "12px",
    color: "#fff",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "1rem",
    marginTop: "8px",
  },
  saveButton: {
    marginTop: "12px",
    background: "#00e5ff",
    border: "none",
    color: "#000",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "40px",
  },
  sectionTitle: {
    fontSize: "28px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "#e0e0e0",
  },
  icon: {
    color: "#00e5ff",
  },
  tableWrapper: {
    background: "#111",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #00e5ff20",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "500px",
  },
  actionButton: {
    background: "#1a1a1a",
    border: "1px solid #00e5ff30",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#00e5ff",
  },
  emptyMessage: {
    background: "#111",
    borderRadius: "24px",
    padding: "40px",
    textAlign: "center",
    color: "#888",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #00e5ff20",
  },
  loadingContainer: {
    background: "linear-gradient(145deg, #0a0a0a 0%, #000000 100%)",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    color: "#00e5ff",
    fontSize: "18px",
  },
  errorContainer: {
    background: "linear-gradient(145deg, #0a0a0a 0%, #000000 100%)",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#ff4444",
  },
};