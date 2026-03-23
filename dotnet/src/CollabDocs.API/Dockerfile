FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/CollabDocs.API/CollabDocs.API.csproj", "src/CollabDocs.API/"]
COPY ["src/CollabDocs.Application/CollabDocs.Application.csproj", "src/CollabDocs.Application/"]
COPY ["src/CollabDocs.Domain/CollabDocs.Domain.csproj", "src/CollabDocs.Domain/"]
COPY ["src/CollabDocs.Infrastructure/CollabDocs.Infrastructure.csproj", "src/CollabDocs.Infrastructure/"]
RUN dotnet restore "src/CollabDocs.API/CollabDocs.API.csproj"
COPY . .
WORKDIR "/src/src/CollabDocs.API"
RUN dotnet build "CollabDocs.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CollabDocs.API.csproj" -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CollabDocs.API.dll"]
