using System.Text.Json;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace CollabDocs.Infrastructure.Cache;

public class DocumentCacheService(
    IConnectionMultiplexer redis,
    ILogger<DocumentCacheService> logger
) : IDocumentCacheService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    // As chaves incluem uma "geração" global. InvalidateAllAsync incrementa a geração,
    // tornando inacessíveis (e expirando pelo TTL) todas as listas anteriores sem SCAN/KEYS.
    private const string GenerationKey = "docs:generation";

    private static string CacheKey(string userId, long generation) => $"docs:user:{userId}:g{generation}";

    private static async Task<long> GetGenerationAsync(IDatabase db)
    {
        var value = await db.StringGetAsync(GenerationKey);
        return value.HasValue && long.TryParse(value.ToString(), out var g) ? g : 0;
    }

    public async Task<List<DocumentDto>?> GetDocumentsAsync(string userId, CancellationToken ct = default)
    {
        try
        {
            var db = redis.GetDatabase();
            var value = await db.StringGetAsync(CacheKey(userId, await GetGenerationAsync(db)));

            if (!value.HasValue)
                return null;

            return JsonSerializer.Deserialize<List<DocumentDto>>(value!, JsonOptions);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis GET failed for user {UserId} — cache miss", userId);
            return null;
        }
    }

    public async Task SetDocumentsAsync(string userId, List<DocumentDto> documents, CancellationToken ct = default)
    {
        try
        {
            var db = redis.GetDatabase();
            var serialized = JsonSerializer.Serialize(documents, JsonOptions);
            await db.StringSetAsync(CacheKey(userId, await GetGenerationAsync(db)), serialized, Ttl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis SET failed for user {UserId} — continuing without cache", userId);
        }
    }

    public async Task InvalidateUserAsync(string userId, CancellationToken ct = default)
    {
        try
        {
            var db = redis.GetDatabase();
            await db.KeyDeleteAsync(CacheKey(userId, await GetGenerationAsync(db)));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis DELETE failed for user {UserId} — cache may be stale", userId);
        }
    }

    public async Task InvalidateAllAsync(CancellationToken ct = default)
    {
        try
        {
            var db = redis.GetDatabase();
            await db.StringIncrementAsync(GenerationKey);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis INCR failed — cached document lists may be stale for up to {Ttl}", Ttl);
        }
    }
}
