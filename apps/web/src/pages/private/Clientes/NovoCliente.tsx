import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { createClient, updateClient, getClientById } from "../../../services/clients";

export default function NovoCliente() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle: "",
    plate: "",
    document: "", // <-- novo campo
    address: "",  // <-- novo campo
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEditing) {
      carregarCliente();
    }
  }, [id]);

  const carregarCliente = async () => {
    try {
      const cliente = await getClientById(Number(id));
      setFormData({
        name: cliente.name,
        phone: cliente.phone,
        vehicle: cliente.vehicle,
        plate: cliente.plate,
        document: cliente.document || "",
        address: cliente.address || "",
      });
    } catch (err: any) {
      setError("Erro ao carregar cliente");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isEditing) {
        await updateClient(Number(id), formData);
      } else {
        await createClient(formData);
      }
      navigate("/clientes");
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #0a0a0a 0%, #000000 100%)",
        minHeight: "100vh",
        padding: "48px 24px",
        color: "#e0e0e0",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <button
            onClick={() => navigate("/clientes")}
            style={{
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
              fontSize: "24px",
              transition: "all 0.2s",
              boxShadow: "0 4px 12px rgba(0, 229, 255, 0.2)",
              marginRight: "16px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
          >
            <FiArrowLeft />
          </button>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: "700",
              background: "linear-gradient(135deg, #00e5ff, #7fdbff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0,
            }}
          >
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </h1>
        </div>

        {/* Formulário */}
        <div
          style={{
            background: "#111",
            borderRadius: "24px",
            padding: "40px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #00e5ff20",
          }}
        >
          {error && (
            <div
              style={{
                background: "#ff444420",
                border: "1px solid #ff4444",
                color: "#ff8888",
                padding: "12px 16px",
                borderRadius: "12px",
                marginBottom: "24px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Nome
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Telefone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Veículo
              </label>
              <input
                type="text"
                name="vehicle"
                value={formData.vehicle}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Placa
              </label>
              <input
                type="text"
                name="plate"
                value={formData.plate}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                  textTransform: "uppercase",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            {/* NOVO CAMPO: Documento */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Documento (CPF/CNPJ/RG/CNH)
              </label>
              <input
                type="text"
                name="document"
                value={formData.document}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            {/* NOVO CAMPO: Endereço */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#a0a0a0" }}>
                Endereço
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00e5ff")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: "100px",
                background: "linear-gradient(135deg, #00e5ff, #0077ff)",
                color: "#000",
                fontWeight: "700",
                fontSize: "1.1rem",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                marginTop: "16px",
                opacity: loading ? 0.6 : 1,
                boxShadow: loading ? "none" : "0 8px 20px rgba(0, 229, 255, 0.3)",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {loading ? "Salvando..." : isEditing ? "Atualizar Cliente" : "Criar Cliente"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}