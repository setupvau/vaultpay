// src/context/AuthContext.jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'LOADED':
      return { ...state, isLoading: false };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // On app start — always fetch full profile from server
  // This ensures referral_code and all fields are always populated
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'LOADED' });
      return;
    }

    // Always fetch full profile — never rely on token payload alone
    authAPI.getMe()
      .then(({ data }) => {
        dispatch({ type: 'SET_USER', payload: data.data });
      })
      .catch(() => {
        localStorage.clear();
        dispatch({ type: 'LOGOUT' });
      });
  }, []);

  const login = (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);

    // After login, immediately fetch full profile to get referral_code etc.
    // We set the basic user first for instant UI, then update with full data
    dispatch({ type: 'SET_USER', payload: user });

    authAPI.getMe()
      .then(({ data }) => {
        dispatch({ type: 'SET_USER', payload: data.data });
      })
      .catch(() => {
        // If getMe fails, keep the basic user from token — not critical
      });
  };

  const logout = () => {
    localStorage.clear();
    dispatch({ type: 'LOGOUT' });
  };

  // Call this anywhere to refresh user data from server
  const refreshUser = () => {
    authAPI.getMe()
      .then(({ data }) => dispatch({ type: 'SET_USER', payload: data.data }))
      .catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
