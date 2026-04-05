# WelpenWache

Interne Webanwendung zur Verwaltung von Praktikanten mit React-Frontend, .NET 10 Minimal API, EF Core Migrations, JWT-Authentifizierung und SQL Server.

## Funktionsumfang

- Praktikanten anlegen und verwalten
- Teams anlegen und farblich kennzeichnen
- Zeitbasierte Teamzuweisungen innerhalb eines Praktikums pflegen
- Monatskalender als Startseite mit Tagesübersicht pro Praktikant und Team
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

## Release-Artefakte

- Jeder Release erstellt ein GitHub Release mit einem IIS-Paket als `welpenwache-iis-<version>.zip`.
- Das IIS-Paket enthaelt bewusst keine `appsettings.Development.json`.
- Zusaetzlich wird ein Docker-Image nach `ghcr.io/sirkyomi/welpenwache:<version>` und `ghcr.io/sirkyomi/welpenwache:latest` veroeffentlicht.

## Compose-Beispiel fuer das Release-Image

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
dotnet run --project .\backend\WelpenWache.Api\WelpenWache.Api.csproj
```

Die API läuft standardmäßig auf `http://localhost:5150`.

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
3. Danach Teams und Praktikanten pflegen
4. Teamwechsel innerhalb eines Praktikums direkt pro Abschnitt hinterlegen

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
