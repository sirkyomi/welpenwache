using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Domain;

namespace WelpenWache.Api.Data;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<UserAccount> Users => Set<UserAccount>();

    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();

    public DbSet<Team> Teams => Set<Team>();

    public DbSet<Intern> Interns => Set<Intern>();

    public DbSet<Internship> Internships => Set<Internship>();

    public DbSet<InternshipAssignment> Assignments => Set<InternshipAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserAccount>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(user => user.Id);
            entity.Property(user => user.UserName).HasMaxLength(100).IsRequired();
            entity.Property(user => user.NormalizedUserName).HasMaxLength(100).IsRequired();
            entity.Property(user => user.PasswordHash).HasMaxLength(200).IsRequired();
            entity.Property(user => user.ThemePreference)
                .HasMaxLength(16)
                .HasDefaultValue(UserAccount.ThemeSystem)
                .IsRequired();
            entity.HasIndex(user => user.NormalizedUserName).IsUnique();
            entity.HasMany(user => user.Permissions)
                .WithOne(permission => permission.UserAccount)
                .HasForeignKey(permission => permission.UserAccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.ToTable("UserPermissions");
            entity.HasKey(permission => new { permission.UserAccountId, permission.Permission });
            entity.Property(permission => permission.Permission).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.ToTable("Teams");
            entity.HasKey(team => team.Id);
            entity.Property(team => team.Name).HasMaxLength(120).IsRequired();
            entity.Property(team => team.NormalizedName).HasMaxLength(120).IsRequired();
            entity.Property(team => team.ColorHex).HasMaxLength(7).IsRequired();
            entity.Property(team => team.Description).HasMaxLength(500);
            entity.HasIndex(team => team.NormalizedName).IsUnique();
        });

        modelBuilder.Entity<Intern>(entity =>
        {
            entity.ToTable("Interns");
            entity.HasKey(intern => intern.Id);
            entity.Property(intern => intern.FirstName).HasMaxLength(120).IsRequired();
            entity.Property(intern => intern.LastName).HasMaxLength(120).IsRequired();
            entity.Property(intern => intern.School).HasMaxLength(200);
            entity.Property(intern => intern.Notes).HasMaxLength(1000);
            entity.HasMany(intern => intern.Internships)
                .WithOne(internship => internship.Intern)
                .HasForeignKey(internship => internship.InternId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Internship>(entity =>
        {
            entity.ToTable("Internships");
            entity.HasKey(internship => internship.Id);
            entity.Property(internship => internship.Note).HasMaxLength(500);
            entity.HasMany(internship => internship.Assignments)
                .WithOne(assignment => assignment.Internship)
                .HasForeignKey(assignment => assignment.InternshipId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InternshipAssignment>(entity =>
        {
            entity.ToTable("Assignments");
            entity.HasKey(assignment => assignment.Id);
            entity.HasOne(assignment => assignment.Team)
                .WithMany(team => team.Assignments)
                .HasForeignKey(assignment => assignment.TeamId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
