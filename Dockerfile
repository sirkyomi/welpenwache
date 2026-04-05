FROM node:24-bookworm-slim AS frontend-build

ARG APP_VERSION=0.1.0-local

WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV APP_VERSION=${APP_VERSION}
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

ARG APP_VERSION=0.1.0-local

WORKDIR /src
COPY . .
COPY --from=frontend-build /src/frontend/dist ./frontend/dist

RUN dotnet publish backend/WelpenWache.Api/WelpenWache.Api.csproj -c Release -o /app/publish -p:Version=${APP_VERSION} -p:InformationalVersion=${APP_VERSION} -p:SkipBundledFrontendBuild=true

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "WelpenWache.Api.dll"]
