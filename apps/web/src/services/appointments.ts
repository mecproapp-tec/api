import api from "./api";

export interface Appointment {
  id: number;
  clientId: number;
  date: string;
  comment?: string;
  client?: {
    id: number;
    name: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
  };
}

// 🔥 NORMALIZA DATA (remove timezone se vier errado)
function normalizeDate(date: string): string {
  if (!date) return date;

  // se vier ISO (com Z), converte para local sem timezone
  if (date.includes("Z")) {
    const d = new Date(date);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  // já está no formato correto
  return date;
}

export const getAppointments = async (): Promise<Appointment[]> => {
  const response = await api.get("/appointments");

  // 🔥 garante consistência na UI
  return response.data.map((app: Appointment) => ({
    ...app,
    date: normalizeDate(app.date),
  }));
};

export const getAppointmentById = async (id: number): Promise<Appointment> => {
  const response = await api.get(`/appointments/${id}`);

  return {
    ...response.data,
    date: normalizeDate(response.data.date),
  };
};

export const createAppointment = async (data: {
  clientId: number;
  date: string;
  comment?: string;
}): Promise<Appointment> => {
  const response = await api.post("/appointments", {
    ...data,
    date: normalizeDate(data.date), // 🔥 garante envio limpo
  });

  return response.data;
};

export const updateAppointment = async (
  id: number,
  data: { clientId: number; date: string; comment?: string }
): Promise<Appointment> => {
  const response = await api.put(`/appointments/${id}`, {
    ...data,
    date: normalizeDate(data.date), // 🔥 garante envio limpo
  });

  return response.data;
};

export const deleteAppointment = async (id: number): Promise<void> => {
  await api.delete(`/appointments/${id}`);
};