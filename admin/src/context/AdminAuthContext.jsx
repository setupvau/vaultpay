// admin/src/context/AdminAuthContext.jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AdminAuthContext = createContext(null);

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { api };

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_ADMIN': return { ...state, admin: action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':    return { admin: null, isAuthenticated: false, isLoading: false };
    case 'LOADED':    return { ...state, isLoading: false };
    default: return state;
  }
};

export const AdminAuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { admin: null, isAuthenticated: false, isLoading: true });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { dispatch({ type: 'LOADED' }); return; }
    api.get('/auth/me')
      .then(({ data }) => {
        const user = data.data;
        if (!['admin', 'superadmin'].includes(user.role)) throw new Error('Not admin');
        dispatch({ type: 'SET_ADMIN', payload: user });
      })
      .catch(() => { localStorage.removeItem('admin_token'); dispatch({ type: 'LOGOUT' }); });
  }, []);

  const login = (admin, token) => {
    localStorage.setItem('admin_token', token);
    dispatch({ type: 'SET_ADMIN', payload: admin });
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    dispatch({ type: 'LOGOUT' });
  };

  return <AdminAuthContext.Provider value={{ ...state, login, logout }}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => useContext(AdminAuthContext);
