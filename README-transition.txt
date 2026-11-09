Dashboard page transitions

1. components/DashboardPageShell.js
2. app/dashboard/template.js  <- from dashboard-template.js
3. app/dashboard/layout.js
4. Append globals-page-transition.css to app/globals.css

Every dashboard route (Calendar, Packages, Settings, …) plays the same short fade-up.
Sidebar stays still. Animation ~180ms for snappy switches.
