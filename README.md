# Priced — Grocery Price Tracker

Track and compare grocery item prices across stores. Log what you paid and where.

## Features

- 📝 Log price entries: item name, category, price, quantity, store, date
- 🏪 Compare prices across different stores (Lotus's, AEON, NSK, etc.)
- 🔍 Search and filter by store or category
- ☁️ Firebase sync — sign in anonymously to sync across devices
- 📱 PWA — install on your phone, works offline
- 🎨 Clean dark theme, mobile-first

## Usage

1. Tap **+** to add a price entry
2. Fill in item name, category, price, quantity, store, date
3. Browse, search, and filter your price log
4. Tap any item to edit or delete

## Firebase

Uses Firebase Realtime Database for cross-device sync. Data stored at `users/{uid}/priced`.

## Deploy

Served via GitHub Pages at [azelinc.github.io/Priced](https://azelinc.github.io/Priced).
