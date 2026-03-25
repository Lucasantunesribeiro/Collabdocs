using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Outbox;
using Microsoft.EntityFrameworkCore;

namespace CollabDocs.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<User> Users => Set<User>();
    public DbSet<DocumentCollaborator> DocumentCollaborators => Set<DocumentCollaborator>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.OwnerId).IsRequired().HasMaxLength(256);
            entity.Property(d => d.Title).IsRequired().HasMaxLength(255);
            entity.Property(d => d.Content).IsRequired();
            entity.Property(d => d.Visibility)
                .HasConversion(v => v.ToString().ToLower(), v => Enum.Parse<Visibility>(v, true));
            entity.Property(d => d.Version).HasDefaultValue(1);
            entity.HasIndex(d => d.OwnerId);
            entity.HasIndex(d => d.UpdatedAt);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(256);
            entity.Property(u => u.Name).IsRequired().HasMaxLength(256);
            entity.Property(u => u.Provider).IsRequired().HasMaxLength(50);
        });

        modelBuilder.Entity<DocumentCollaborator>(entity =>
        {
            entity.HasKey(dc => dc.Id);
            entity.HasIndex(dc => new { dc.DocumentId, dc.UserEmail }).IsUnique();
            entity.Property(dc => dc.UserEmail).IsRequired().HasMaxLength(256);
            entity.Property(dc => dc.Permission)
                .HasConversion(p => p.ToString().ToLower(), p => Enum.Parse<Permission>(p, true));
            entity.HasIndex(dc => dc.DocumentId);
        });

        modelBuilder.Entity<OutboxMessage>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.EventType).IsRequired().HasMaxLength(128);
            entity.Property(m => m.Payload).IsRequired();
            entity.Property(m => m.IdempotencyKey).HasMaxLength(256);
            entity.HasIndex(m => new { m.ProcessedAt, m.RetryCount }); // for efficient polling
            entity.HasIndex(m => m.IdempotencyKey);
        });
    }
}
