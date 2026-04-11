using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Infrastructure;

namespace WelpenWache.Api.Endpoints;

public static class AuditLogEndpoints
{
    public static IEndpointRouteBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/audit-logs")
            .RequireAuthorization(Policies.AdminOnly);

        group.MapGet("/", async (
            string? entityType,
            Guid? entityId,
            string? action,
            Guid? actorUserId,
            DateTime? fromUtc,
            DateTime? toUtc,
            int? page,
            int? pageSize,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!string.IsNullOrWhiteSpace(action))
            {
                var normalizedAction = AuditLogActions.Normalize(action);
                if (!AuditLogActions.IsValid(normalizedAction))
                {
                    return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Der Audit-Log-Filter 'action' ist ungueltig."));
                }

                action = normalizedAction;
            }

            var resolvedPage = Math.Max(page ?? 1, 1);
            var resolvedPageSize = Math.Clamp(pageSize ?? 50, 1, 200);

            var query = dbContext.AuditLogs.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(entityType))
            {
                query = query.Where(item => item.EntityType == entityType.Trim());
            }

            if (entityId.HasValue && entityId.Value != Guid.Empty)
            {
                query = query.Where(item => item.EntityId == entityId.Value);
            }

            if (!string.IsNullOrWhiteSpace(action))
            {
                query = query.Where(item => item.Action == action);
            }

            if (actorUserId.HasValue && actorUserId.Value != Guid.Empty)
            {
                query = query.Where(item => item.ActorUserId == actorUserId.Value);
            }

            if (fromUtc.HasValue)
            {
                query = query.Where(item => item.OccurredUtc >= fromUtc.Value);
            }

            if (toUtc.HasValue)
            {
                query = query.Where(item => item.OccurredUtc <= toUtc.Value);
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var items = await query
                .OrderByDescending(item => item.OccurredUtc)
                .ThenByDescending(item => item.Id)
                .Skip((resolvedPage - 1) * resolvedPageSize)
                .Take(resolvedPageSize)
                .ToListAsync(cancellationToken);

            return Results.Ok(new AuditLogListResponse(
                items.Select(item => item.ToListItemResponse()).ToList(),
                totalCount,
                resolvedPage,
                resolvedPageSize));
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var auditLog = await dbContext.AuditLogs
                .AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

            return auditLog is null
                ? Results.NotFound(new ApiError("AUDIT_LOG_NOT_FOUND", "Der Audit-Log-Eintrag wurde nicht gefunden."))
                : Results.Ok(auditLog.ToDetailResponse());
        });

        return endpoints;
    }
}
