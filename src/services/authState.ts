interface PendingLink {
    code: string;
    createdAt: number;
    status: 'pending' | 'linked';
    technician?: {
      telegramId: number;
      username?: string;
      firstName: string;
      lastName?: string;
    };
  }
  
  // In-memory storage (Map<code, data>)
  const activeCodes = new Map<string, PendingLink>();
  
  // Clean up codes older than 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [code, data] of activeCodes.entries()) {
      if (now - data.createdAt > 5 * 60 * 1000) {
        activeCodes.delete(code);
      }
    }
  }, 60 * 1000);
  
  export const authState = {
    createCode: (): string => {
      // Generate 6 digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      activeCodes.set(code, {
        code,
        createdAt: Date.now(),
        status: 'pending'
      });
      return code;
    },
  
    verifyCode: (code: string) => {
      return activeCodes.get(code);
    },
  
    linkUser: (code: string, userData: any) => {
      const entry = activeCodes.get(code);
      if (!entry) return false;
      
      entry.status = 'linked';
      entry.technician = userData;
      activeCodes.set(code, entry);
      return true;
    },
  
    removeCode: (code: string) => {
      activeCodes.delete(code);
    }
  };