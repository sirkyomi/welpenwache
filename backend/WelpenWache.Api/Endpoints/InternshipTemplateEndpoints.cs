using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Endpoints;

public static class InternshipTemplateEndpoints
{
    public static IEndpointRouteBuilder MapInternshipTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/internship-templates")
            .RequireAuthorization();

        group.MapGet("/", async (
            ClaimsPrincipal principal,
            bool? includeInactive,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!ApiAccess.CanAccessInternshipTemplates(principal))
            {
                return Results.Forbid();
            }

            var includeInactiveValue = includeInactive ?? false;

            if (includeInactiveValue && !ApiAccess.CanManageInterns(principal))
            {
                return Results.Forbid();
            }

            var query = IncludeTemplateGraph(dbContext.InternshipTemplates.AsNoTracking());

            if (!includeInactiveValue)
            {
                query = query.Where(template => template.IsActive);
            }

            var templates = await query
                .OrderBy(template => template.IsActive ? 0 : 1)
                .ThenBy(template => template.Name)
                .ToListAsync(cancellationToken);

            return Results.Ok(templates.Select(template => template.ToResponse()));
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!ApiAccess.CanAccessInternshipTemplates(principal))
            {
                return Results.Forbid();
            }

            var template = await LoadTemplateAsync(dbContext, id, cancellationToken);
            if (template is null)
            {
                return Results.NotFound(new ApiError("INTERNSHIP_TEMPLATE_NOT_FOUND", "Die Praktikums-Vorlage wurde nicht gefunden."));
            }

            if (!template.IsActive && !ApiAccess.CanManageInterns(principal))
            {
                return Results.NotFound(new ApiError("INTERNSHIP_TEMPLATE_NOT_FOUND", "Die Praktikums-Vorlage wurde nicht gefunden."));
            }

            return Results.Ok(template.ToResponse());
        });

        group.MapPost("/", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            InternshipTemplateUpsertRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var validationError = await ApiValidation.ValidateInternshipTemplateRequestAsync(request, dbContext);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            var template = new InternshipTemplate
            {
                Name = request.Name.Trim(),
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                IsActive = request.IsActive
            };

            template.Assignments = BuildTemplateAssignments(template.Id, request.Assignments);

            dbContext.InternshipTemplates.Add(template);
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteCreateAsync(dbContext, principal, "internshipTemplate", template.Id, cancellationToken);

            var createdTemplate = await LoadTemplateAsync(dbContext, template.Id, cancellationToken);
            if (createdTemplate is null)
            {
                return Results.NotFound(new ApiError(
                    "INTERNSHIP_TEMPLATE_NOT_FOUND",
                    "Die Praktikums-Vorlage wurde nach dem Speichern nicht gefunden."));
            }

            return Results.Created($"/api/internship-templates/{template.Id}", createdTemplate.ToResponse());
        });

        group.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            Guid id,
            InternshipTemplateUpsertRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "internshipTemplate", id, cancellationToken);
            var template = await dbContext.InternshipTemplates
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (template is null)
            {
                return Results.NotFound(new ApiError("INTERNSHIP_TEMPLATE_NOT_FOUND", "Die Praktikums-Vorlage wurde nicht gefunden."));
            }

            var validationError = await ApiValidation.ValidateInternshipTemplateRequestAsync(request, dbContext);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            template.Name = request.Name.Trim();
            template.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            template.IsActive = request.IsActive;

            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

            await dbContext.InternshipTemplateAssignments
                .Where(assignment => assignment.InternshipTemplateId == id)
                .ExecuteDeleteAsync(cancellationToken);

            dbContext.InternshipTemplateAssignments.AddRange(BuildTemplateAssignments(id, request.Assignments));

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            if (auditCapture is not null)
            {
                await auditLogService.WriteUpdateAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            var updatedTemplate = await LoadTemplateAsync(dbContext, id, cancellationToken);
            if (updatedTemplate is null)
            {
                return Results.NotFound(new ApiError(
                    "INTERNSHIP_TEMPLATE_NOT_FOUND",
                    "Die Praktikums-Vorlage wurde nach dem Speichern nicht gefunden."));
            }

            return Results.Ok(updatedTemplate.ToResponse());
        });

        group.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "internshipTemplate", id, cancellationToken);
            var template = await dbContext.InternshipTemplates
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (template is null)
            {
                return Results.NotFound(new ApiError("INTERNSHIP_TEMPLATE_NOT_FOUND", "Die Praktikums-Vorlage wurde nicht gefunden."));
            }

            dbContext.InternshipTemplates.Remove(template);
            await dbContext.SaveChangesAsync(cancellationToken);

            if (auditCapture is not null)
            {
                await auditLogService.WriteDeleteAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/apply", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            Guid id,
            InternshipTemplateApplyRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var template = await LoadTemplateAsync(dbContext, id, cancellationToken);
            if (template is null)
            {
                return Results.NotFound(new ApiError("INTERNSHIP_TEMPLATE_NOT_FOUND", "Die Praktikums-Vorlage wurde nicht gefunden."));
            }

            if (!template.IsActive)
            {
                return Results.BadRequest(new ApiError(
                    "INTERNSHIP_TEMPLATE_INACTIVE",
                    "Deaktivierte Praktikums-Vorlagen können nicht angewendet werden."));
            }

            var response = template.ToApplyResponse(request.StartDate);
            var validationError = ApiValidation.ValidateAppliedInternshipTemplate(response);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            return Results.Ok(response);
        });

        return endpoints;
    }

    private static Task<InternshipTemplate?> LoadTemplateAsync(
        ApplicationDbContext dbContext,
        Guid id,
        CancellationToken cancellationToken) =>
        IncludeTemplateGraph(dbContext.InternshipTemplates.AsNoTracking())
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

    private static IQueryable<InternshipTemplate> IncludeTemplateGraph(IQueryable<InternshipTemplate> query) =>
        query
            .Include(item => item.Assignments)
                .ThenInclude(assignment => assignment.Team)
            .Include(item => item.Assignments)
                .ThenInclude(assignment => assignment.Supervisor);

    private static List<InternshipTemplateAssignment> BuildTemplateAssignments(
        Guid templateId,
        IReadOnlyList<InternshipTemplateAssignmentRequest> assignments) =>
        assignments
            .OrderBy(assignment => assignment.SortOrder)
            .ThenBy(assignment => assignment.StartOffsetDays)
            .ThenBy(assignment => assignment.EndOffsetDays)
            .Select(assignment => new InternshipTemplateAssignment
            {
                InternshipTemplateId = templateId,
                TeamId = assignment.TeamId,
                SupervisorId = assignment.SupervisorId,
                StartOffsetDays = assignment.StartOffsetDays,
                EndOffsetDays = assignment.EndOffsetDays,
                SortOrder = assignment.SortOrder
            })
            .ToList();
}
