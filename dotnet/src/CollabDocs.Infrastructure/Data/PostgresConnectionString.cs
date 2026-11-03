using Npgsql;

namespace CollabDocs.Infrastructure.Data;

/// <summary>
/// Aceita a connection string tanto no formato do Npgsql ("Host=...;Database=...")
/// quanto no formato URI ("postgresql://user:senha@host:5432/db?sslmode=require"),
/// que é o que Neon, Supabase e Render exibem. O Npgsql não entende URI sozinho.
/// </summary>
public static class PostgresConnectionString
{
    public static string Normalize(string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        var raw = connectionString.Trim();

        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return raw;

        var uri = new Uri(raw);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
        };

        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo.Length > 0 && userInfo[0].Length > 0)
            builder.Username = Uri.UnescapeDataString(userInfo[0]);
        if (userInfo.Length > 1)
            builder.Password = Uri.UnescapeDataString(userInfo[1]);

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(kv[0]).ToLowerInvariant();
            var value = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : string.Empty;
            if (key == "sslmode" && Enum.TryParse<SslMode>(value.Replace("-", ""), ignoreCase: true, out var mode))
                builder.SslMode = mode;
            // Demais parâmetros (ex.: channel_binding) são ignorados: o padrão do Npgsql serve.
        }

        return builder.ConnectionString;
    }
}
