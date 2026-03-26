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

export const getAppointments = async (): Promise<Appointment[]> => {
  const response = await api.get("/appointments");
  return response.data;
};

export const getAppointmentById = async (id: number): Promise<Appointment> => {
  const response = await api.get(`/appointments/${id}`);
  return response.data;
};

export const createAppointment = async (data: { clientId: number; date: string; comment?: string }): Promise<Appointment> => {
  const response = await api.post("/appointments", data);
  return response.data;
};

export const updateAppointment = async (id: number, data: { clientId: number; date: string; comment?: string }): Promise<Appointment> => {
  const response = await api.put(`/appointments/${id}`, data);
  return response.data;
};

export const deleteAppointment = async (id: number): Promise<void> => {
  await api.delete(`/appointments/${id}`);
};