import './styles/main.css';

export function bootstrap() {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<div class="p-6 text-center text-sm text-muted">Đang tải ứng dụng chia tiền giặt sấy...</div>';
  }
}

if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', bootstrap);
}
