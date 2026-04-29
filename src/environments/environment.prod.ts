// ✅ Configuración de PRODUCCIÓN (cuando Vercel hace build con `ng build`)
export const environment = {
  production: true,
  apiUrl: 'https://app-restaurant-api.onrender.com/api',
  apiBaseUrl: 'https://app-restaurant-api.onrender.com' // sin /api, para SignalR
};