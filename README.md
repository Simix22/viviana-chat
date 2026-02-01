# Viviana KI-Influencer Chat Platform

## 📁 Dateien-Übersicht

### User-App (Haupt-Website)
- `index.html` - Hauptseite für User
- `style.css` - User-App Styling
- `script.js` - User-App Funktionalität

### Admin-Panel
- `admin.html` - Admin Dashboard
- `admin-style.css` - Admin Styling
- `admin-script.js` - Admin Funktionalität

## 🚀 So testen Sie die App

### 1. User-App öffnen
1. Öffnen Sie `index.html` im Browser
2. Klicken Sie auf "Get Started"
3. Erstellen Sie einen Account (Sign Up)
   - Name: z.B. "Max Mustermann"
   - Email: z.B. "max@test.com"
   - Password: z.B. "test123"
4. Sie werden zum Chat weitergeleitet
5. Schreiben Sie eine Nachricht an Viviana
6. Die Nachricht wird **automatisch im Admin Panel gespeichert**!

### 2. Admin-Panel öffnen
1. Öffnen Sie `admin.html` im gleichen Browser (neuer Tab)
2. Login mit:
   - Username: `admin`
   - Password: `admin123`
3. Sie sehen jetzt:
   - **Total Users: 1** (Ihr Test-Account)
   - **Credits Sold: 3** (Ihre Start-Credits)
   - **User-Liste** mit Ihrem Account

### 3. Als Viviana antworten
1. Im Admin-Panel: Klicken Sie auf "Chat" Button bei Ihrem User
2. Sie sehen **alle Nachrichten** die der User geschrieben hat
3. Tippen Sie eine Antwort als Viviana
4. Klicken Sie "Send"
5. Gehen Sie zurück zur User-App (`index.html`)
6. Die Antwort von Viviana erscheint im Chat! ✨

## 🔄 Workflow-Test

### Kompletter Test-Durchlauf:

1. **User-App** (`index.html`):
   - Account erstellen: max@test.com
   - Nachricht senden: "Hey Viviana!"

2. **Admin-Panel** (`admin.html`):
   - Login als Admin
   - User "max@test.com" sehen
   - Auf "Chat" klicken
   - Nachricht "Hey Viviana!" sehen
   - Antworten: "Hi Max! How are you?"

3. **Zurück zur User-App**:
   - Tab wechseln oder neu laden
   - Antwort von Viviana erscheint!

## 💾 Daten-Speicherung

Alle Daten werden in **localStorage** gespeichert:

- `vivianaUsers` - Alle registrierten User
- `vivianaCredits` - Credits des aktuellen Users
- `vivianaAdminMessages` - Alle Chat-Nachrichten
- `vivianaUser` - Aktuell eingeloggter User

## 🐛 Fehlerbehebung

### Problem: "Total Users: 0"
**Lösung:**
1. Drücken Sie F12 → Console
2. Tippen Sie: `localStorage.getItem('vivianaUsers')`
3. Wenn leer: Erstellen Sie einen neuen User in der User-App

### Problem: "Admin-Nachrichten erscheinen nicht"
**Lösung:**
1. Beide Tabs müssen denselben Browser verwenden
2. User-App Seite neu laden (F5)
3. Chat-Screen öffnen

### Problem: "Dashboard bleibt leer nach Login"
**Lösung:**
1. Browser-Konsole öffnen (F12)
2. Nach Fehlern suchen
3. Seite neu laden (Strg + Shift + R)

## 📊 Features

### User-App
✅ Login/Signup
✅ Chat mit Viviana
✅ Credits-System (3 gratis)
✅ Credits kaufen
✅ Profil bearbeiten
✅ Profilbild hochladen
✅ Verification-Popup

### Admin-Panel
✅ Sicherer Login
✅ User-Übersicht
✅ Analytics (Stats)
✅ Chat als Viviana
✅ User Details ansehen
✅ Echtzeit-Updates

## 🎯 Nächste Schritte (Optional)

Für echte Production:
- Backend mit Node.js/Python
- Echte Datenbank (PostgreSQL/MongoDB)
- Echtes Payment (Stripe)
- WebSocket für Live-Chat
- KI-Integration (OpenAI API)
- Push-Benachrichtigungen
