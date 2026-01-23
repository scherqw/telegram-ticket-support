/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface TicketsResponse {
  tickets: any[];
}

interface ArchivedTicketsResponse {
  tickets: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TicketResponse {
  ticket: any;
}

interface SuccessResponse {
  success: boolean;
}

export interface Category {
  id: string;
  label: string;
  description?: string;
}

class APIClient {
  private initData: string = '';

  setInitData(initData: string) {
    this.initData = initData;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': this.initData,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getOpenTickets(): Promise<TicketsResponse> {
    return this.request<TicketsResponse>('/tickets/open');
  }

  async getArchivedTickets(page: number = 1): Promise<ArchivedTicketsResponse> {
    return this.request<ArchivedTicketsResponse>(`/tickets/archived?page=${page}`);
  }

  async getTicket(ticketId: string): Promise<TicketResponse> {
    return this.request<TicketResponse>(`/tickets/${ticketId}`);
  }

  async markAsRead(ticketId: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/tickets/${ticketId}/read`, {
      method: 'POST'
    });
  }

  async sendReply(ticketId: string, message: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  async uploadMedia(ticketId: string, file: File, caption?: string): Promise<SuccessResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/media`, {
      method: 'POST',
      headers: {
        'X-Telegram-Init-Data': this.initData,
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async closeTicket(ticketId: string, categories: string[]): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/tickets/${ticketId}/close`, {
      method: 'POST',
      body: JSON.stringify({ categories })
    });
  }

  async escalateTicket(ticketId: string, reason: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/tickets/${ticketId}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async getCategories(): Promise<Category[]> {
    const response = await this.request<{ categories: Category[] }>('/tickets/categories');
    return response.categories;
  }
}

export const apiClient = new APIClient();