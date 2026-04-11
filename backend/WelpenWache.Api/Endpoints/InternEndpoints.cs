using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Endpoints;

public static class InternEndpoints
{
    public static IEndpointRouteBuilder MapInternEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/interns")
            .RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, ApplicationDbContext dbContext) =>
        {
            if (!ApiAccess.CanAccessInterns(principal))
            {
                return Results.Forbid();
            }

            var interns = await dbContext.Interns
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                .OrderBy(item => item.LastName)
                .ThenBy(item => item.FirstName)
                .ToListAsync();

            return Results.Ok(interns.Select(item => item.ToResponse()));
        });

        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal principal, ApplicationDbContext dbContext) =>
        {
            if (!ApiAccess.CanAccessInterns(principal))
            {
                return Results.Forbid();
            }

            var intern = await dbContext.Interns
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                .SingleOrDefaultAsync(item => item.Id == id);

            return intern is null
                ? Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."))
                : Results.Ok(intern.ToResponse());
        });

        group.MapPost("/", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            InternRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var validationError = await ApiValidation.ValidateInternRequestAsync(request, dbContext);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            var intern = request.ToEntity();
            dbContext.Interns.Add(intern);
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteCreateAsync(dbContext, principal, "intern", intern.Id, cancellationToken);

            var createdIntern = await dbContext.Interns
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                .SingleAsync(item => item.Id == intern.Id, cancellationToken);

            return Results.Created($"/api/interns/{intern.Id}", createdIntern.ToResponse());
        });

        group.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            Guid id,
            InternRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "intern", id, cancellationToken);
            var existingIntern = await dbContext.Interns
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (existingIntern is null)
            {
                return Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."));
            }

            var validationError = await ApiValidation.ValidateInternRequestAsync(request, dbContext);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            existingIntern.FirstName = request.FirstName.Trim();
            existingIntern.LastName = request.LastName.Trim();
            existingIntern.Gender = InternGenderCatalog.Normalize(request.Gender);
            existingIntern.School = request.School?.Trim();
            existingIntern.Notes = request.Notes?.Trim();

            await using var transaction = await dbContext.Database.BeginTransactionAsync();

            await dbContext.Internships
                .Where(internship => internship.InternId == id)
                .ExecuteDeleteAsync();

            var replacementInternships = request.Internships
                .OrderBy(internship => internship.StartDate)
                .Select(internship => new Internship
                {
                    InternId = id,
                    StartDate = internship.StartDate,
                    EndDate = internship.EndDate,
                    Note = internship.Note?.Trim(),
                    Assignments = internship.Assignments
                        .OrderBy(assignment => assignment.StartDate)
                        .Select(assignment => new InternshipAssignment
                        {
                            TeamId = assignment.TeamId,
                            SupervisorId = assignment.SupervisorId,
                            StartDate = assignment.StartDate,
                            EndDate = assignment.EndDate
                        })
                        .ToList()
                })
                .ToList();

            if (replacementInternships.Count > 0)
            {
                dbContext.Internships.AddRange(replacementInternships);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync();
            if (auditCapture is not null)
            {
                await auditLogService.WriteUpdateAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            var updatedIntern = await dbContext.Interns
                .AsNoTracking()
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                .SingleAsync(item => item.Id == id, cancellationToken);

            return Results.Ok(updatedIntern.ToResponse());
        });

        group.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "intern", id, cancellationToken);
            var intern = await dbContext.Interns.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (intern is null)
            {
                return Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."));
            }

            dbContext.Interns.Remove(intern);
            await dbContext.SaveChangesAsync(cancellationToken);
            if (auditCapture is not null)
            {
                await auditLogService.WriteDeleteAsync(dbContext, principal, auditCapture, cancellationToken);
            }
            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/completion-documents", async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            CompletionDocumentService completionDocumentService,
            CancellationToken cancellationToken) =>
        {
            if (!ApiAccess.CanAccessDocuments(principal))
            {
                return Results.Forbid();
            }

            var intern = await dbContext.Interns
                .AsNoTracking()
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Team)
                .Include(item => item.Internships)
                    .ThenInclude(internship => internship.Assignments)
                        .ThenInclude(assignment => assignment.Supervisor)
                .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (intern is null)
            {
                return Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."));
            }

            var templates = await dbContext.DocumentTemplates
                .AsNoTracking()
                .Where(item => item.IsActive && item.Purpose == DocumentTemplatePurposeCatalog.Completion)
                .OrderBy(item => item.Name)
                .ToListAsync(cancellationToken);

            if (templates.Count == 0)
            {
                return Results.BadRequest(new ApiError(
                    "NO_COMPLETION_TEMPLATES",
                    "Fuer den Abschlussworkflow sind keine aktiven Vorlagen hinterlegt."));
            }

            var generatedDocuments = await completionDocumentService.GenerateAsync(intern, templates, cancellationToken);
            var download = generatedDocuments.Count == 1
                ? generatedDocuments[0]
                : completionDocumentService.CreateArchive(intern, generatedDocuments);

            return Results.File(download.Content, download.ContentType, download.FileName);
        });

        return endpoints;
    }
}
