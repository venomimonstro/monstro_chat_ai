import { api } from './api';

export async function downloadLeadsCsv() {
  const res = await api.get('/export/leads.csv', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leads.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadTenantDataJson() {
  const res = await api.get('/export/tenant-data.json', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tenant-export.json';
  link.click();
  URL.revokeObjectURL(url);
}
