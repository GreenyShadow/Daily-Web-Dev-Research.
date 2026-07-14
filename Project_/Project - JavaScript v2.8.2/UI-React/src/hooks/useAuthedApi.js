import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../lib/api.js';

// Wraps every api.* call so a 401 (expired/invalid session) drops the user
// back to the login screen instead of surfacing a raw error everywhere.
export function useAuthedApi() {
  const { session, forceLogout } = useAuth();
  const token = session?.token;

  const call = useCallback(
    async (fn, ...args) => {
      try {
        return await fn(token, ...args);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          forceLogout();
        }
        throw err;
      }
    },
    [token, forceLogout]
  );

  return useMemo(
    () => ({
      listUsers: () => call(api.listUsers),
      createUser: (user) => call(api.createUser, user),
      updateUser: (username, updates) => call(api.updateUser, username, updates),
      deleteUser: (username) => call(api.deleteUser, username),
      listAgents: () => call(api.listAgents),

      listTickets: () => call(api.listTickets),
      getTicket: (id) => call(api.getTicket, id),
      createTicket: (ticket) => call(api.createTicket, ticket),
      updateTicket: (id, updates) => call(api.updateTicket, id, updates),
      deleteTicket: (id) => call(api.deleteTicket, id),
      claimTicket: (id) => call(api.claimTicket, id),
      releaseTicket: (id) => call(api.releaseTicket, id),
      reassignTicket: (id, to) => call(api.reassignTicket, id, to),
      addComment: (id, text) => call(api.addComment, id, text),
    }),
    [call]
  );
}
