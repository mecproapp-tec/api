import api from "./api";

export interface Client {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  address?: string;
  document?: string;
  createdAt: string;
  updatedAt?: string;
}

export const getClients = async (): Promise<Client[]> => {
  const response = await api.get("/clients");
  return response.data;
};

export const getClientById = async (id: number): Promise<Client> => {
  const response = await api.get(`/clients/${id}`);
  return response.data;
};

export const createClient = async (data: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> => {
  const response = await api.post("/clients", data);
  return response.data;
};

export const updateClient = async (id: number, data: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>): Promise<Client> => {
  const response = await api.put(`/clients/${id}`, data);
  return response.data;
};

export const deleteClient = async (id: number): Promise<void> => {
  await api.delete(`/clients/${id}`);
};

export const getVehicleDisplay = (client: Client): string => {
  return client.vehicle || "Não informado";
};