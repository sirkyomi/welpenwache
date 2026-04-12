using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Endpoints;

public static class TeamEndpoints
{
    public static IEndpointRouteBuilder MapTeamEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/teams")
            .RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, ApplicationDbContext dbContext) =>
        {
            if (!ApiAccess.CanAccessTeams(principal))
            {
                return Results.Forbid();
            }

            var teams = await dbContext.Teams
                .Include(team => team.Supervisors)
                .OrderBy(team => team.IsArchived)
                .ThenBy(team => team.Name)
                .ToListAsync();

            return Results.Ok(teams.Select(team => team.ToResponse()));
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext) =>
        {
            if (!ApiAccess.CanAccessTeams(principal))
            {
                return Results.Forbid();
            }

            var team = await dbContext.Teams
                .Include(item => item.Supervisors)
                .Include(item => item.Assignments)
                    .ThenInclude(assignment => assignment.Supervisor)
                .Include(item => item.Assignments)
                    .ThenInclude(assignment => assignment.Internship)
                        .ThenInclude(internship => internship.Intern)
                .SingleOrDefaultAsync(item => item.Id == id);

            return team is null
                ? Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."))
                : Results.Ok(team.ToDetailResponse());
        });

        group.MapPost("/", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
            TeamRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var validationError = await ApiValidation.ValidateTeamAsync(request, dbContext, null);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            var team = new Team
            {
                Name = request.Name.Trim(),
                NormalizedName = ApiValidation.NormalizeKey(request.Name),
                Description = request.Description?.Trim(),
                ColorHex = ApiValidation.NormalizeColor(request.ColorHex),
                IsArchived = request.IsArchived,
                Supervisors = (request.Supervisors ?? [])
                    .Select(supervisor => new Supervisor
                    {
                        Name = supervisor.Name.Trim(),
                        NormalizedName = ApiValidation.NormalizeKey(supervisor.Name),
                        Notes = supervisor.Notes?.Trim()
                    })
                    .ToList()
            };

            dbContext.Teams.Add(team);
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteCreateAsync(dbContext, principal, "team", team.Id, cancellationToken);
            return Results.Created($"/api/teams/{team.Id}", team.ToResponse());
        });

        group.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
            Guid id,
            TeamRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "team", id, cancellationToken);
            var team = await dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (team is null)
            {
                return Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."));
            }

            var validationError = await ApiValidation.ValidateTeamAsync(request, dbContext, id);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            team.Name = request.Name.Trim();
            team.NormalizedName = ApiValidation.NormalizeKey(request.Name);
            team.Description = request.Description?.Trim();
            team.ColorHex = ApiValidation.NormalizeColor(request.ColorHex);
            team.IsArchived = request.IsArchived;
            var existingSupervisors = await dbContext.Supervisors
                .Where(supervisor => supervisor.TeamId == id)
                .ToListAsync(cancellationToken);

            ApiValidation.SyncSupervisors(dbContext, id, existingSupervisors, request.Supervisors ?? []);

            await dbContext.SaveChangesAsync(cancellationToken);
            if (auditCapture is not null)
            {
                await auditLogService.WriteUpdateAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            var updatedTeam = await dbContext.Teams
                .Include(item => item.Supervisors)
                .SingleAsync(item => item.Id == id, cancellationToken);

            return Results.Ok(updatedTeam.ToResponse());
        });

        group.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "team", id, cancellationToken);
            var team = await dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (team is null)
            {
                return Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."));
            }

            var hasAssignments = await dbContext.Assignments.AnyAsync(item => item.TeamId == id, cancellationToken);
            var hasTemplateAssignments = await dbContext.InternshipTemplateAssignments
                .AnyAsync(item => item.TeamId == id, cancellationToken);

            if (hasAssignments || hasTemplateAssignments)
            {
                return Results.BadRequest(new ApiError(
                    "TEAM_IN_USE",
                    "Teams mit bestehenden Zuweisungen oder Vorlagen koennen nicht geloescht werden."));
            }

            dbContext.Teams.Remove(team);
            await dbContext.SaveChangesAsync(cancellationToken);
            if (auditCapture is not null)
            {
                await auditLogService.WriteDeleteAsync(dbContext, principal, auditCapture, cancellationToken);
            }
            return Results.NoContent();
        });

        return endpoints;
    }
}
