# Firebase Google Login Setup Guide

Dieser Guide zeigt dir, wie du Google Login für Viviana Chat mit Firebase Authentication einrichtest.

## Schritt 1: Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Klicke auf "Projekt hinzufügen" (oder "Add Project")
3. Gib deinem Projekt einen Namen, z.B. "viviana-chat"
4. Optional: Deaktiviere Google Analytics (nicht nötig für dieses Projekt)
5. Klicke auf "Projekt erstellen"

## Schritt 2: Web-App registrieren

1. In der Firebase Console, klicke auf das **Web-Icon** `</>`
2. Gib deiner App einen Namen: "Viviana Chat Web"
3. **WICHTIG:** Aktiviere "Firebase Hosting" NICHT (du verwendest Vercel)
4. Klicke auf "App registrieren"

## Schritt 3: Firebase Konfiguration kopieren

Du siehst jetzt ein Code-Snippet mit deiner Firebase-Konfiguration:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "viviana-chat-xxxxx.firebaseapp.com",
  projectId: "viviana-chat-xxxxx",
  storageBucket: "viviana-chat-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

**Kopiere diese Werte!** Du brauchst sie gleich.

## Schritt 4: Firebase Credentials in Code einfügen

1. Öffne die Datei `script.js`
2. Suche nach diesem Abschnitt (ca. Zeile 30-40):

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. **Ersetze die Platzhalter** mit deinen echten Werten aus Schritt 3:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "viviana-chat-xxxxx.firebaseapp.com",
    projectId: "viviana-chat-xxxxx",
    storageBucket: "viviana-chat-xxxxx.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

## Schritt 5: Google Sign-In aktivieren

1. In der Firebase Console, gehe zu **Authentication** (in der linken Seitenleiste)
2. Klicke auf **Get Started** (falls du Authentication noch nie verwendet hast)
3. Gehe zum Tab **Sign-in method**
4. Klicke auf **Google** in der Liste der Provider
5. Klicke auf den **Enable** Toggle
6. Wähle eine Support-E-Mail aus (deine eigene E-Mail)
7. Klicke auf **Save**

## Schritt 6: Autorisierte Domains hinzufügen

Firebase erlaubt standardmäßig nur `localhost` und `*.firebaseapp.com`.

Du musst deine Vercel-Domain autorisieren:

1. In **Authentication > Settings > Authorized domains**
2. Klicke auf "Add domain"
3. Füge hinzu: `viviana-chat.vercel.app` (oder deine eigene Vercel-Domain)
4. Optional: Füge weitere Domains hinzu (z.B. Custom Domain)

**Wichtige Domains:**
- ✅ `localhost` (bereits autorisiert - für lokales Testing)
- ✅ `viviana-chat.vercel.app` (deine Vercel-Deployment-URL)
- ✅ Deine Custom Domain (falls vorhanden, z.B. `chat.deinedomain.de`)

## Schritt 7: Code commiten und deployen

1. Speichere alle Änderungen in `script.js`
2. Commit und push die Änderungen:

```bash
git add script.js
git commit -m "Add Firebase Google Login configuration"
git push
```

3. Vercel wird automatisch neu deployen

## Schritt 8: Testen

1. Öffne deine Vercel-URL: `https://viviana-chat.vercel.app`
2. Klicke auf "Get Started"
3. Klicke auf "Continue with Google"
4. Wähle dein Google-Konto
5. Du solltest jetzt eingeloggt sein!

## Troubleshooting

### "Google Sign-In is not configured"

**Problem:** Firebase-Konfiguration ist noch nicht korrekt eingetragen.

**Lösung:** Überprüfe, ob du die richtigen Credentials in `script.js` eingetragen hast.

### "This domain is not authorized"

**Problem:** Deine Vercel-Domain ist nicht in Firebase autorisiert.

**Lösung:**
1. Gehe zu Firebase Console > Authentication > Settings > Authorized domains
2. Füge `viviana-chat.vercel.app` hinzu
3. Warte 1-2 Minuten und versuche es erneut

### "Popup blocked"

**Problem:** Browser blockiert das Google Sign-In Popup.

**Lösung:** Erlaube Popups für deine Website in den Browser-Einstellungen.

### "Network error"

**Problem:** Firebase API kann nicht erreicht werden.

**Lösung:**
1. Überprüfe deine Internetverbindung
2. Stelle sicher, dass Firebase APIs in deinem Netzwerk nicht blockiert sind
3. Öffne die Browser-Konsole (F12) für detaillierte Fehler

## Sicherheitshinweise

### API Key Sicherheit

**Ist es sicher, den API Key im Frontend-Code zu haben?**

✅ **JA!** Firebase API Keys sind für die Verwendung im Frontend gedacht und können öffentlich sein.

Die Sicherheit wird durch:
- Autorisierte Domains (nur deine Domains können die API nutzen)
- Firebase Security Rules
- Authentication-Regeln

**ABER:** Stelle sicher, dass:
- Nur autorisierte Domains in Firebase konfiguriert sind
- Du Firebase Security Rules richtig einstellst (falls du Firestore/Database verwendest)

### Firebase Security Rules (Optional)

Wenn du später Firebase Firestore oder Realtime Database nutzen möchtest:

```javascript
// Firestore Security Rules Beispiel
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Features die jetzt funktionieren

✅ Google Sign-In mit Popup
✅ Automatische Account-Erstellung für neue Google-User
✅ Automatischer Login für existierende Google-User
✅ E-Mail-Verifizierung für Google-Accounts (automatisch verified)
✅ 10 Welcome Credits für neue Google-User
✅ Profilbild von Google übernommen
✅ Logout mit Firebase Sign-Out
✅ Session-Persistenz (bleibt eingeloggt nach Browser-Neustart)

## Nächste Schritte (Optional)

### Multi-Provider Login

Du kannst weitere Login-Methoden hinzufügen:
- Facebook Login
- Apple Sign-In
- GitHub Login
- Twitter Login
- Microsoft Login

Alle werden in Firebase Console > Authentication > Sign-in method konfiguriert.

### Email Link Authentication

Passwortloser Login per E-Mail-Link (wie bei Notion oder Slack):

```javascript
firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
```

## Support

Bei Problemen:
1. Prüfe die Browser-Konsole (F12) für Fehler
2. Schaue in die [Firebase Documentation](https://firebase.google.com/docs/auth/web/google-signin)
3. Prüfe [Firebase Console](https://console.firebase.google.com/) für Status-Meldungen

---

**Viel Erfolg mit deinem Google Login!** 🚀
