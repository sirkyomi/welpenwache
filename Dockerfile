FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

ARG APP_VERSION=0.1.0-local

RUN apt-get update \
    && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN dotnet publish backend/WelpenWache.Api/WelpenWache.Api.csproj -c Release -o /app/publish -p:Version=${APP_VERSION} -p:InformationalVersion=${APP_VERSION}

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "WelpenWache.Api.dll"]
