# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files first for layer caching
COPY MembersGuild.Data/MembersGuild.Data.csproj MembersGuild.Data/
COPY MembersGuild.API/MembersGuild.API.csproj MembersGuild.API/

# Restore dependencies
RUN dotnet restore MembersGuild.API/MembersGuild.API.csproj

# Copy source
COPY . .

# Build and publish
RUN dotnet publish MembersGuild.API/MembersGuild.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 dotnet && \
    adduser --system --uid 1001 dotnet

COPY --from=build /app/publish .

# Create uploads directory (profile photos, logos — until S3)
RUN mkdir -p /app/uploads && chown -R dotnet:dotnet /app

USER dotnet

EXPOSE 5015

ENV ASPNETCORE_URLS=http://+:5015
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "MembersGuild.API.dll"]
