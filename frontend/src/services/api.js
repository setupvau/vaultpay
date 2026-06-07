// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !orig._retry) {
      orig._retry = true;
      try {
        const rt = localStorage.getItem('refresh_token');
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt });
        localStorage.setItem('access_token', data.data.access_token);
        orig.headers.Authorization = `Bearer ${data.data.access_token}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  login:    (d) => api.post('/auth/login', d),
  getMe:    ()  => api.get('/auth/me'),
};

export const walletAPI = {
  getBalance:       ()   => api.get('/wallet/balance'),
  getLedger:        (p)  => api.get('/wallet/ledger', { params: p }),
  getNotifications: ()   => api.get('/wallet/notifications'),
  getNotifCount:    ()   => api.get('/wallet/notifications/count'),
  getSupport:       ()   => api.get('/wallet/support'),
  getReferralStats: ()   => api.get('/wallet/referral-stats'),
  getMyInvites:     ()   => api.get('/wallet/my-invites'),
};

export const depositAPI = {
  getUSDTRate:     ()  => api.get('/deposit/usdt-rate'), 
  createUSDT:      (d) => api.post('/deposit/usdt', d),
  submitUSDTProof: (fd) => api.post('/deposit/usdt/proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createINR:       (d)  => api.post('/deposit/inr', d),
  checkINROrder:   (id) => api.get(`/deposit/inr/${id}`),
  submitINRProof:  (fd) => api.post('/deposit/inr/proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getHistory:      (p)  => api.get('/deposit/history', { params: p }),
};

export const withdrawalAPI = {
  create:     (d) => api.post('/withdrawal', d),
  getHistory: (p) => api.get('/withdrawal/history', { params: p }),
};

export const investmentAPI = {
  getPlans: ()  => api.get('/investment/plans'),
  buy:      (d) => api.post('/investment/buy', d),
  getMine:  ()  => api.get('/investment/mine'),
};

export const broadcastAPI = {
  getActive:  () => api.get('/broadcast/active'),
  markRead:   (id) => api.post(`/broadcast/${id}/read`),
  getNotices: () => api.get('/broadcast/notices'),
};

export const adminAPI = {
  getDashboard:          ()        => api.get('/admin/dashboard'),
  getDeposits:           (p)       => api.get('/admin/deposits', { params: p }),
  reviewDeposit:         (id, d)   => api.patch(`/admin/deposits/${id}/review`, d),
  getPendingAssignments: ()        => api.get('/admin/deposits/pending-assignments'),
  assignBank:            (id, d)   => api.post(`/admin/deposits/${id}/assign`, d),
  getWithdrawals:        (p)       => api.get('/admin/withdrawals', { params: p }),
  reviewWithdrawal:      (id, d)   => api.patch(`/admin/withdrawals/${id}/review`, d),
  getInvestments:        (p)       => api.get('/admin/investments', { params: p }),
  processMatured:        ()        => api.post('/admin/investments/process-matured'),
  getUsers:              (p)       => api.get('/admin/users', { params: p }),
  getUserDetail:         (id)      => api.get(`/admin/users/${id}`),
  freezeUser:            (id, d)   => api.patch(`/admin/users/${id}/freeze`, d),
  adjustWallet:          (id, d)   => api.post(`/admin/users/${id}/wallet/adjust`, d),
  getBroadcasts:         ()        => api.get('/admin/broadcasts'),
  createBroadcast:       (d)       => api.post('/admin/broadcasts', d),
  toggleBroadcast:       (id)      => api.patch(`/admin/broadcasts/${id}/toggle`),
  deleteBroadcast:       (id)      => api.delete(`/admin/broadcasts/${id}`),
  getNotices:            ()        => api.get('/admin/notices'),
  createNotice:          (d)       => api.post('/admin/notices', d),
  toggleNotice:          (id)      => api.patch(`/admin/notices/${id}/toggle`),
  deleteNotice:          (id)      => api.delete(`/admin/notices/${id}`),
  getSettings:           ()        => api.get('/admin/settings'),
  updateSetting:         (key, d)  => api.put(`/admin/settings/${key}`, d),
  getBankAccounts:       ()        => api.get('/admin/bank-accounts'),
  addBankAccount:        (d)       => api.post('/admin/bank-accounts', d),
  updateUSDTAddr:        (d)       => api.post('/admin/usdt-addresses', d),
  getAuditLogs:          (p)       => api.get('/admin/logs', { params: p }),
};

export default api;
