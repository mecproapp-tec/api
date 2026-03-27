import { useCallback } from "react";
import api from "../services/api";

export function useWhatsApp() {
  const enviarWhatsApp = useCallback(
    async (tipo: "invoice" | "estimate", id: number) => {
      try {
        const url = `/${tipo}s/${id}/send-whatsapp`;

        console.log("📡 Chamando endpoint:", url);

        const response = await api.post(url);

        console.log("✅ Resposta API:", response.data);

        const { whatsappLink, queued, message } = response.data;

        // 🔥 SE JÁ TEM LINK → abre WhatsApp
        if (whatsappLink) {
          window.open(whatsappLink, "_blank");
          return;
        }

        // 🔥 SE ESTÁ EM FILA (BullMQ)
        if (queued) {
          alert("📄 PDF está sendo gerado. Tente novamente em alguns segundos.");
          return;
        }

        throw new Error("Resposta inesperada do servidor");
      } catch (error: any) {
        console.error("❌ Erro completo:", error);

        alert(
          error.response?.data?.message ||
          "Erro ao enviar WhatsApp. Verifique o backend."
        );
      }
    },
    []
  );

  return { enviarWhatsApp };
}