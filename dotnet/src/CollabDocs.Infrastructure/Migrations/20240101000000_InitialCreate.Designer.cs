using System;
using CollabDocs.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CollabDocs.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20240101000000_InitialCreate")]
partial class InitialCreate
{
    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.8")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity("CollabDocs.Domain.Entities.Document", b =>
        {
            b.Property<Guid>("Id").HasColumnType("uuid");
            b.Property<string>("Content").IsRequired().HasColumnType("text");
            b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
            b.Property<string>("OwnerId").IsRequired().HasMaxLength(256).HasColumnType("character varying(256)");
            b.Property<string>("Title").IsRequired().HasMaxLength(255).HasColumnType("character varying(255)");
            b.Property<DateTime>("UpdatedAt").HasColumnType("timestamp with time zone");
            b.Property<int>("Version").HasDefaultValue(1).HasColumnType("integer");
            b.Property<string>("Visibility").IsRequired().HasColumnType("text");
            b.HasKey("Id");
            b.HasIndex("OwnerId");
            b.HasIndex("UpdatedAt");
            b.ToTable("Documents");
        });

        modelBuilder.Entity("CollabDocs.Domain.Entities.DocumentCollaborator", b =>
        {
            b.Property<Guid>("DocumentId").HasColumnType("uuid");
            b.Property<string>("UserId").HasColumnType("text");
            b.Property<DateTime>("GrantedAt").HasColumnType("timestamp with time zone");
            b.Property<string>("Permission").IsRequired().HasColumnType("text");
            b.Property<string>("UserEmail").IsRequired().HasMaxLength(256).HasColumnType("character varying(256)");
            b.HasKey("DocumentId", "UserId");
            b.HasIndex("DocumentId");
            b.ToTable("DocumentCollaborators");
        });

        modelBuilder.Entity("CollabDocs.Domain.Entities.User", b =>
        {
            b.Property<string>("Id").HasColumnType("text");
            b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
            b.Property<string>("Email").IsRequired().HasMaxLength(256).HasColumnType("character varying(256)");
            b.Property<string>("Name").IsRequired().HasMaxLength(256).HasColumnType("character varying(256)");
            b.Property<string>("Provider").IsRequired().HasMaxLength(50).HasColumnType("character varying(50)");
            b.Property<DateTime>("UpdatedAt").HasColumnType("timestamp with time zone");
            b.HasKey("Id");
            b.ToTable("Users");
        });
#pragma warning restore 612, 618
    }
}
