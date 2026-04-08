# WelpenWache

Interne Webanwendung zur Verwaltung von Praktikanten mit React-Frontend, .NET 10 Minimal API, EF Core Migrations, JWT-Authentifizierung und SQL Server.

## Funktionsumfang

- Praktikanten anlegen, verwalten und mit Geschlecht pflegen
- Teams anlegen und farblich kennzeichnen
- Zeitbasierte Teamzuweisungen innerhalb eines Praktikums pflegen
- Monatskalender als Startseite mit Tagesübersicht pro Praktikant und Team
- Administrierbare Dokumentvorlagen für Abschlussdokumente hochladen und verwalten
- Abschluss-Workflow pro Praktikant mit direktem Download generierter Dokumente
- Initialer Administrator beim ersten Start
- Weitere Benutzerkonten durch Administratoren
- Rechte für Praktikanten und Teams

## Projektstruktur

- `backend/WelpenWache.Api`: .NET 10 Minimal API, EF Core, SQL Server, JWT
- `frontend`: React, Vite, shadcn/ui, TanStack Query

## Voraussetzungen

- .NET SDK 10
- Node.js 24+
- Docker Desktop für die einfache SQL-Server-Variante
- Für Dokumentvorlagen ein beschreibbarer absoluter Pfad auf dem Server

## Release-Artefakte

- Jeder Release erstellt ein GitHub Release mit einem IIS-Paket als `welpenwache-iis-<version>.zip`.
- Das IIS-Paket enthält bewusst keine `appsettings.Development.json`.
- Zusätzlich wird ein Docker-Image nach `ghcr.io/sirkyomi/welpenwache:<version>` und `ghcr.io/sirkyomi/welpenwache:latest` veröffentlicht.

## Compose-Beispiel für das Release-Image

```yaml
services:
  welpenwache:
    image: ghcr.io/sirkyomi/welpenwache:0.1.0
    depends_on:
      - sqlserver
    ports:
      - "8080:8080"
    environment:
      ConnectionStrings__DefaultConnection: "Server=sqlserver,1433;Database=WelpenWacheDb;User Id=sa;Password=<DEIN_PASSWORT>;TrustServerCertificate=True;"
      Jwt__SigningKey: "<MINDESTENS_32_ZEICHEN_LANGER_GEHEIMSCHLUESSEL>"

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "<DEIN_PASSWORT>"
    volumes:
      - sqlserver-data:/var/opt/mssql

volumes:
  sqlserver-data:
```

Für einen echten Release-Einsatz die Image-Version im Compose-File auf die veröffentlichte Version setzen und nicht dauerhaft `latest` verwenden.

## Datenbank per Docker starten

1. `.env.example` nach `.env` kopieren und ein eigenes starkes Passwort setzen.
2. SQL Server starten:

```powershell
docker compose up -d
```

## Backend starten

PowerShell:

```powershell
$env:ConnectionStrings__DefaultConnection="Server=localhost,14333;Database=WelpenWacheDb;User Id=sa;Password=<DEIN_PASSWORT>;TrustServerCertificate=True;"
$env:DocumentStorage__BasePath="C:\ProgramData\WelpenWache\DocumentTemplates"
dotnet run --project .\backend\WelpenWache.Api\WelpenWache.Api.csproj
```

Die API läuft standardmäßig auf `http://localhost:5150`.

## Dokumentvorlagen konfigurieren

Für den Abschluss-Workflow werden DOCX-Vorlagen im Dateisystem gespeichert. In der Datenbank liegt nur der relative Pfad.

Beispiel in `appsettings.json`:

```json
{
  "DocumentStorage": {
    "BasePath": "C:\\ProgramData\\WelpenWache\\DocumentTemplates"
  },
  "CompletionDocuments": {
    "Salutations": {
      "male": {
        "de": "Herr",
        "en": "Mr."
      },
      "female": {
        "de": "Frau",
        "en": "Ms."
      },
      "diverse": {
        "de": "Guten Tag",
        "en": "Mx."
      }
    }
  }
}
```

Wichtig:

- `DocumentStorage:BasePath` muss ein absoluter Pfad sein.
- Vorlagen werden im Admin-Bereich unter `Dokumentvorlagen` hochgeladen.
- Aktive Vorlagen mit dem Zweck `completion` werden beim Abschluss eines Praktikanten automatisch erzeugt.
- Bei mehreren aktiven Vorlagen liefert der Workflow ein ZIP-Archiv, bei genau einer Vorlage direkt die DOCX-Datei.

## Vorlagen-Syntax

Die Dokumentgenerierung verwendet [`DocxTemplater`](https://github.com/Amberg/DocxTemplater). Dadurch bleiben Formatierung und Layout der DOCX-Vorlage erhalten.

Unterstützte Platzhalter in der Vorlage sind zum Beispiel:

- `{{first_name}}`
- `{{last_name}}`
- `{{full_name}}`
- `{{salutation}}`
- `{{start_date}}`
- `{{end_date}}`
- `{{team}}`
- `{{gender}}`
- `{{school}}`
- `{{notes}}`

Für wiederholte Bereiche stehen Sammlungen bereit, zum Beispiel:

```text
{{#team_assignments}}
- {{.team_name}} ({{.start_date}} - {{.end_date}})
{{/team_assignments}}
```

Zusätzlich gibt es `internships` mit verschachtelten `assignments`, falls Vorlagen mehrere Praktikumszeiträume getrennt darstellen sollen.

## Frontend starten

PowerShell:

```powershell
cd .\frontend
$env:VITE_API_URL="http://localhost:5150"
npm install
npm run dev
```

Das Frontend läuft standardmäßig auf `http://localhost:5173`.

Backend und Frontend werden immer gemeinsam ausgeliefert und verwenden deshalb genau eine gemeinsame Produktversion. Angezeigt wird sie als SemVer plus 7-stelligem Commit-Hash.

## Initialer Start

1. Frontend öffnen
2. Administrator-Benutzername und Passwort anlegen
3. Danach Teams, Praktikanten und Geschlecht pflegen
4. Im Admin-Bereich Dokumentvorlagen für den Zweck `completion` hochladen
5. Teamwechsel innerhalb eines Praktikums direkt pro Abschnitt hinterlegen
6. In der Praktikantenansicht den Abschluss-Workflow auslösen und die generierten Dokumente herunterladen

## Build und Prüfung

Backend:

```powershell
dotnet build .\backend\WelpenWache.Api\WelpenWache.Api.csproj
```

Frontend:

```powershell
cd .\frontend
npm run build
```

## Hinweise

- Standardmäßig ist im Backend `LocalDB` konfiguriert. Auf diesem Rechner war `LocalDB` nicht installiert, daher ist die Docker-Variante der reproduzierbare Startweg.
- EF-Core-Migrationen liegen in `backend/WelpenWache.Api/Migrations`.
- UI-Texte sind auf Deutsch, Quellcode und API-Namen auf Englisch.
- Bestehende Praktikanten erhalten über die Migration initial das Geschlecht `male` und können danach im UI angepasst werden.
