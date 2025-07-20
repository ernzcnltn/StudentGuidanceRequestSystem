class NotificationService {
  constructor() {
    this.permission = 'default';
    this.init();
  }

  async init() {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
    }
  }

  show(title, options = {}) {
    if (this.permission === 'granted' && 'Notification' in window) {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  }

  showRequestUpdate(requestId, newStatus) {
    return this.show(`Request #${requestId} Updated`, {
      body: `Your request status has been changed to: ${newStatus}`,
      tag: `request-${requestId}`,
      icon: '/favicon.ico'
    });
  }

  showNewResponse(requestId) {
    return this.show(`New Response to Request #${requestId}`, {
      body: 'You have received a new response from the admin',
      tag: `response-${requestId}`,
      icon: '/favicon.ico'
    });
  }

  showNewRequest(requestId, studentName, priority) {
    return this.show(`New ${priority} Priority Request`, {
      body: `Request #${requestId} from ${studentName}`,
      tag: `new-request-${requestId}`,
      icon: '/favicon.ico'
    });
  }
}

export default new NotificationService();
