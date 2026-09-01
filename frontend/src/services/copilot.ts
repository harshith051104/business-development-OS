import { api } from './api'
import type {
  CopilotChatRequest,
  CopilotChatResponse,
  CopilotConfirmRequest,
  CopilotConfirmResponse,
  CopilotConversation,
  CopilotMessage,
  CopilotSuggestion,
} from '../types/copilot'

export const copilotService = {
  sendMessage: async (payload: CopilotChatRequest): Promise<CopilotChatResponse> => {
    return api.post<CopilotChatResponse>('/api/business-development/copilot/chat', payload)
  },

  confirmAction: async (payload: CopilotConfirmRequest): Promise<CopilotConfirmResponse> => {
    return api.post<CopilotConfirmResponse>('/api/business-development/copilot/confirm', payload)
  },

  listConversations: async (limit = 20): Promise<CopilotConversation[]> => {
    return api.get<CopilotConversation[]>('/api/business-development/copilot/conversations', { limit })
  },

  getConversationMessages: async (conversationId: string): Promise<CopilotMessage[]> => {
    return api.get<CopilotMessage[]>(`/api/business-development/copilot/conversations/${conversationId}`)
  },

  deleteConversation: async (conversationId: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/api/business-development/copilot/conversations/${conversationId}`)
  },

  getSuggestions: async (currentPage?: string): Promise<CopilotSuggestion[]> => {
    return api.get<CopilotSuggestion[]>('/api/business-development/copilot/suggestions', {
      current_page: currentPage || '',
    })
  },
}
