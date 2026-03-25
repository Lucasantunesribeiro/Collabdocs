# ── Build stage ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restore dependencies first (layer-cached unless csproj files change)
COPY ["src/CollabDocs.API/CollabDocs.API.csproj", "src/CollabDocs.API/"]
COPY ["src/CollabDocs.Application/CollabDocs.Application.csproj", "src/CollabDocs.Application/"]
COPY ["src/CollabDocs.Domain/CollabDocs.Domain.csproj", "src/CollabDocs.Domain/"]
COPY ["src/CollabDocs.Infrastructure/CollabDocs.Infrastructure.csproj", "src/CollabDocs.Infrastructure/"]
RUN dotnet restore "src/CollabDocs.API/CollabDocs.API.csproj"

# Copy source and publish
COPY . .
WORKDIR "/src/src/CollabDocs.API"
RUN dotnet publish "CollabDocs.API.csproj" -c Release -o /app/publish

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

# Lambda Web Adapter — translates Lambda Function URL invocations to HTTP.
# Enables running this ASP.NET Core app as AWS Lambda without code changes.
# Remove these two lines if deploying outside Lambda (App Runner, ECS, etc.)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=5000
ENV AWS_LWA_READINESS_CHECK_PATH=/health

# Run as non-root user (app user is built into the aspnet image)
USER app

COPY --from=build --chown=app:app /app/publish .

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "CollabDocs.API.dll"]
