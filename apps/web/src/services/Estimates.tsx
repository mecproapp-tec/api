import api from "./api";

export interface EstimateItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
  total: number;
  issPercent?: number;
}

export interface Estimate {
  id: number;
  clientId: number;
  date: string;
  total: number;
  status: "pending" | "accepted" | "converted";
  pdfUrl?: string;
  pdfStatus?: string;
  pdfGeneratedAt?: string;
  createdAt: string;
  updatedAt?: string;
  shareToken?: string;
  shareTokenExpires?: string;
  items: EstimateItem[];
  client?: {
    id: number;
    name: string;
    phone: string;
    vehicle: string;
    plate: string;
    address?: string;
    document?: string;
  };
}

export interface CreateEstimateData {
  clientId: number;
  date: string;
  items: Omit<EstimateItem, "id" | "total">[];
  status?: string;
}

const statusToBackend: Record<string, string> = {
  pending: "DRAFT",
  accepted: "APPROVED",
  converted: "CONVERTED",
};

const statusToFrontend: Record<string, string> = {
  DRAFT: "pending",
  APPROVED: "accepted",
  CONVERTED: "converted",
};

export const getEstimates = async (): Promise<Estimate[]> => {
  try {
    const response = await api.get("/estimates");
    return response.data.map((est: any) => ({
      ...est,
      status: statusToFrontend[est.status] || est.status,
    }));
  } catch (error: any) {
    if (error.response?.status === 404) return [];
    throw error;
  }
};

export const getEstimateById = async (id: number): Promise<Estimate> => {
  const response = await api.get(`/estimates/${id}`);
  const est = response.data;
  return {
    ...est,
    status: statusToFrontend[est.status] || est.status,
  };
};

export const createEstimate = async (data: CreateEstimateData): Promise<Estimate> => {
  const payload = { ...data, status: "DRAFT" };
  const response = await api.post("/estimates", payload);
  const est = response.data;
  return {
    ...est,
    status: statusToFrontend[est.status] || est.status,
  };
};

export const updateEstimate = async (id: number, data: CreateEstimateData): Promise<Estimate> => {
  const payload = {
    ...data,
    status: data.status ? statusToBackend[data.status] || data.status : undefined,
  };
  const response = await api.put(`/estimates/${id}`, payload);
  const est = response.data;
  return {
    ...est,
    status: statusToFrontend[est.status] || est.status,
  };
};

export const deleteEstimate = async (id: number): Promise<void> => {
  await api.delete(`/estimates/${id}`);
};