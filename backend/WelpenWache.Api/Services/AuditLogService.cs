using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;

namespace WelpenWache.Api.Services;

internal sealed class AuditCapture
{
    public required AuditedEntitySnapshot Snapshot { get; init; }
}

internal sealed class AuditLogService
{
    public async Task<AuditCapture?> CaptureAsync(
        ApplicationDbContext dbContext,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default)
    {
        var snapshot = await LoadSnapshotAsync(dbContext, entityType, entityId, cancellationToken);
        return snapshot is null ? null : new AuditCapture { Snapshot = snapshot };
    }

    public async Task WriteCreateAsync(
        ApplicationDbContext dbContext,
        ClaimsPrincipal? principal,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default)
    {
        var after = await RequireSnapshotAsync(dbContext, entityType, entityId, cancellationToken);
        var auditLog = AuditLogFactory.Create(principal, AuditLogActions.Create, beforeSnapshot: null, after);
        await WriteLogAsync(dbContext, auditLog, cancellationToken);
    }

    public async Task WriteUpdateAsync(
        ApplicationDbContext dbContext,
        ClaimsPrincipal? principal,
        AuditCapture before,
        CancellationToken cancellationToken = default)
    {
        var after = await RequireSnapshotAsync(
            dbContext,
            before.Snapshot.EntityType,
            before.Snapshot.EntityId,
            cancellationToken);
        var auditLog = AuditLogFactory.Create(principal, AuditLogActions.Update, before.Snapshot, after);
        await WriteLogAsync(dbContext, auditLog, cancellationToken);
    }

    public async Task WriteDeleteAsync(
        ApplicationDbContext dbContext,
        ClaimsPrincipal? principal,
        AuditCapture before,
        CancellationToken cancellationToken = default)
    {
        var auditLog = AuditLogFactory.Create(principal, AuditLogActions.Delete, before.Snapshot, afterSnapshot: null);
        await WriteLogAsync(dbContext, auditLog, cancellationToken);
    }

    private async Task<AuditedEntitySnapshot> RequireSnapshotAsync(
        ApplicationDbContext dbContext,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken)
    {
        var snapshot = await LoadSnapshotAsync(dbContext, entityType, entityId, cancellationToken);
        if (snapshot is null)
        {
            throw new InvalidOperationException($"Audit snapshot for {entityType}:{entityId} could not be loaded.");
        }

        return snapshot;
    }

    private static async Task WriteLogAsync(
        ApplicationDbContext dbContext,
        AuditLog? auditLog,
        CancellationToken cancellationToken)
    {
        if (auditLog is null)
        {
            return;
        }

        dbContext.AuditLogs.Add(auditLog);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task<AuditedEntitySnapshot?> LoadSnapshotAsync(
        ApplicationDbContext dbContext,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken)
    {
        switch (entityType)
        {
            case "intern":
            {
                var intern = await dbContext.Interns
                    .AsNoTracking()
                    .Include(item => item.Internships)
                        .ThenInclude(internship => internship.Assignments)
                            .ThenInclude(assignment => assignment.Team)
                    .Include(item => item.Internships)
                        .ThenInclude(internship => internship.Assignments)
                            .ThenInclude(assignment => assignment.Supervisor)
                    .SingleOrDefaultAsync(item => item.Id == entityId, cancellationToken);

                return intern is null ? null : AuditLogFactory.CaptureSnapshot(intern);
            }
            case "team":
            {
                var team = await dbContext.Teams
                    .AsNoTracking()
                    .Include(item => item.Supervisors)
                    .SingleOrDefaultAsync(item => item.Id == entityId, cancellationToken);

                return team is null ? null : AuditLogFactory.CaptureSnapshot(team);
            }
            case "user":
            {
                var user = await dbContext.Users
                    .AsNoTracking()
                    .Include(item => item.Permissions)
                    .SingleOrDefaultAsync(item => item.Id == entityId, cancellationToken);

                return user is null ? null : AuditLogFactory.CaptureSnapshot(user);
            }
            case "documentTemplate":
            {
                var template = await dbContext.DocumentTemplates
                    .AsNoTracking()
                    .SingleOrDefaultAsync(item => item.Id == entityId, cancellationToken);

                return template is null ? null : AuditLogFactory.CaptureSnapshot(template);
            }
            case "internshipTemplate":
            {
                var template = await dbContext.InternshipTemplates
                    .AsNoTracking()
                    .Include(item => item.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                    .Include(item => item.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                    .SingleOrDefaultAsync(item => item.Id == entityId, cancellationToken);

                return template is null ? null : AuditLogFactory.CaptureSnapshot(template);
            }
            default:
                throw new InvalidOperationException($"Unsupported audit entity type '{entityType}'.");
        }
    }
}
