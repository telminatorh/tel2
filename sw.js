// TEL – teenindustöötaja (service worker). Vajalik ainult selleks, et rakenduse saaks telefoni installida.
// NB! Midagi EI salvestata vahemällu: iga kord laetakse värske versioon GitHubist,
// nii et uuenduste üleslaadimine käib täpselt nagu enne.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
