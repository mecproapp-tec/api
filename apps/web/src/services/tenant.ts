import api from './api';

export async function updateTenant(data: {
  nome: string;
  documento: string;
  numero: string;
  endereco: string;
  telefone: string;
  email: string;
  logo?: string;
}) {
  const response = await api.patch('/tenants/me', data);
  return response.data;
}