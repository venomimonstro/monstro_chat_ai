import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000';

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body ok': (r) => r.json('status') === 'ok',
  });

  const db = http.get(`${BASE_URL}/api/health/db`);
  check(db, { 'db health 200': (r) => r.status === 200 });

  const tariffs = http.get(`${BASE_URL}/api/public/tariffs`);
  check(tariffs, { 'public tariffs 200': (r) => r.status === 200 });

  sleep(0.2);
}
