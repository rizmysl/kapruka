// Ayla Reminder Service Worker
// Runs in the background and fires push notifications for upcoming events

const REMINDER_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const KAPRUKA_URL = self.location.origin;

self.addEventListener('install', (event) => {
    console.log('[Ayla SW] Service Worker installed.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Ayla SW] Service Worker activated.');
    event.waitUntil(clients.claim());
});

// Listen for messages from the main app (e.g. "new reminder added")
self.addEventListener('message', (event) => {
    if (event.data?.type === 'CHECK_REMINDERS') {
        checkAndFireReminders(event.data.reminders || []);
    }
    if (event.data?.type === 'SCHEDULE_REMINDER') {
        // Just acknowledge — main app handles storage
        console.log('[Ayla SW] Reminder registered:', event.data.reminder);
    }
});

function checkAndFireReminders(reminders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    reminders.forEach((reminder) => {
        if (!reminder.event_date || !reminder.event_name) return;

        const eventDate = new Date(reminder.event_date);
        eventDate.setHours(0, 0, 0, 0);

        const daysUntil = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        // Fire notification at 7 days, 3 days, 1 day before, and on the day
        const notifyAt = [7, 3, 1, 0];

        if (notifyAt.includes(daysUntil)) {
            const alreadyNotifiedKey = `ayla_notified_${reminder.id}_${daysUntil}`;

            // Check if we've already sent this exact notification
            // (We can't access localStorage from SW, so we use a simple in-memory guard + rely on the client to pass state)
            let title, body;

            if (daysUntil === 0) {
                title = `🎉 Today is ${reminder.event_name}!`;
                body = `Don't forget! Shop the perfect gift on Kapruka right now. 🎁`;
            } else if (daysUntil === 1) {
                title = `⏰ ${reminder.event_name} is Tomorrow!`;
                body = `Last chance to order! Let Ayla help you find the perfect gift on Kapruka. 🎁`;
            } else {
                title = `🎁 ${daysUntil} Days Until ${reminder.event_name}!`;
                body = `Start planning now! Ayla is ready to help you find something special on Kapruka.`;
            }

            self.registration.showNotification(title, {
                body,
                icon: `${KAPRUKA_URL}/favicon.svg`,
                badge: `${KAPRUKA_URL}/favicon.svg`,
                tag: alreadyNotifiedKey, // Prevents duplicate notifications
                requireInteraction: daysUntil === 0 || daysUntil === 1,
                data: { url: KAPRUKA_URL }
            });
        }
    });
}

// Handle notification click — open the Kapruka app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || KAPRUKA_URL;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(KAPRUKA_URL) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
