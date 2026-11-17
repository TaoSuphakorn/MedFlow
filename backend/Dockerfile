FROM mcr.microsoft.com/dotnet/sdk:10.0 AS sdk
WORKDIR /src
COPY backend/src/MedFlow.Api/MedFlow.Api.csproj backend/src/MedFlow.Api/
COPY backend/tests/MedFlow.Tests/MedFlow.Tests.csproj backend/tests/MedFlow.Tests/
RUN dotnet restore backend/tests/MedFlow.Tests/MedFlow.Tests.csproj
COPY backend/ backend/
FROM sdk AS test
ENTRYPOINT ["dotnet", "test", "backend/tests/MedFlow.Tests/MedFlow.Tests.csproj", "--logger", "console;verbosity=normal"]
FROM sdk AS publish
RUN dotnet publish backend/src/MedFlow.Api/MedFlow.Api.csproj -c Release -o /app --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=publish /app .
RUN mkdir -p /keys && chown -R $APP_UID:$APP_UID /keys
USER $APP_UID
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "MedFlow.Api.dll"]
