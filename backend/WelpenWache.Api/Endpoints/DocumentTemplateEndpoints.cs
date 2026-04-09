using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Endpoints;

public static class DocumentTemplateEndpoints
{
    public static IEndpointRouteBuilder MapDocumentTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/document-templates")
            .RequireAuthorization();

        group.MapGet("/", async (
            ClaimsPrincipal principal,
            string? purpose,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!ApiAccess.CanAccessDocuments(principal))
            {
                return Results.Forbid();
            }

            var query = dbContext.DocumentTemplates.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(purpose))
            {
                var normalizedPurpose = ApiValidation.NormalizeTemplatePurpose(purpose);
                query = query.Where(item => item.Purpose == normalizedPurpose);
            }

            var templates = await query
                .OrderBy(item => item.Purpose)
                .ThenBy(item => item.Language)
                .ThenBy(item => item.Name)
                .ToListAsync(cancellationToken);

            return Results.Ok(templates.Select(item => item.ToResponse()));
        });

        group.MapGet("/completion-placeholders", (
            ClaimsPrincipal principal,
            IOptions<CompletionDocumentOptions> completionDocumentOptions) =>
        {
            if (!ApiAccess.CanAccessDocuments(principal))
            {
                return Results.Forbid();
            }

            var options = completionDocumentOptions.Value;
            return Results.Ok(new CompletionDocumentPlaceholderConfigurationResponse(
                ApiValidation.ToConfiguredValueMap(options.Genders),
                ApiValidation.ToConfiguredValueMap(options.Salutations)));
        });

        group.MapPost("/", [Authorize(Policy = PermissionCatalog.DocumentsManage)] async (
            [FromForm] DocumentTemplateUpsertForm form,
            ApplicationDbContext dbContext,
            TemplateStorageService templateStorageService,
            CancellationToken cancellationToken) =>
        {
            var validationError = ApiValidation.ValidateDocumentTemplateForm(form, fileRequired: true);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            StoredTemplateFile? storedFile = null;

            try
            {
                storedFile = await templateStorageService.SaveTemplateAsync(form.File!, cancellationToken);

                var template = new DocumentTemplate
                {
                    Name = form.Name.Trim(),
                    Purpose = ApiValidation.NormalizeTemplatePurpose(form.Purpose),
                    Language = ApiValidation.NormalizeTemplateLanguage(form.Language),
                    RelativeFilePath = storedFile.RelativeFilePath,
                    OriginalFileName = storedFile.OriginalFileName,
                    IsActive = form.IsActive
                };

                dbContext.DocumentTemplates.Add(template);
                await dbContext.SaveChangesAsync(cancellationToken);

                return Results.Created($"/api/document-templates/{template.Id}", template.ToResponse());
            }
            catch (InvalidOperationException exception)
            {
                if (storedFile is not null)
                {
                    templateStorageService.DeleteTemplate(storedFile.RelativeFilePath);
                }

                return Results.BadRequest(new ApiError("VALIDATION_ERROR", exception.Message));
            }
        })
            .DisableAntiforgery();

        group.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.DocumentsManage)] async (
            Guid id,
            [FromForm] DocumentTemplateUpsertForm form,
            ApplicationDbContext dbContext,
            TemplateStorageService templateStorageService,
            CancellationToken cancellationToken) =>
        {
            var template = await dbContext.DocumentTemplates.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (template is null)
            {
                return Results.NotFound(new ApiError("TEMPLATE_NOT_FOUND", "Die Dokumentvorlage wurde nicht gefunden."));
            }

            var validationError = ApiValidation.ValidateDocumentTemplateForm(form, fileRequired: false);
            if (validationError is not null)
            {
                return Results.BadRequest(validationError);
            }

            var previousRelativeFilePath = template.RelativeFilePath;
            StoredTemplateFile? storedFile = null;

            try
            {
                if (form.File is not null)
                {
                    storedFile = await templateStorageService.SaveTemplateAsync(form.File, cancellationToken);
                    template.RelativeFilePath = storedFile.RelativeFilePath;
                    template.OriginalFileName = storedFile.OriginalFileName;
                }

                template.Name = form.Name.Trim();
                template.Purpose = ApiValidation.NormalizeTemplatePurpose(form.Purpose);
                template.Language = ApiValidation.NormalizeTemplateLanguage(form.Language);
                template.IsActive = form.IsActive;

                await dbContext.SaveChangesAsync(cancellationToken);

                if (storedFile is not null)
                {
                    templateStorageService.DeleteTemplate(previousRelativeFilePath);
                }

                return Results.Ok(template.ToResponse());
            }
            catch (InvalidOperationException exception)
            {
                if (storedFile is not null)
                {
                    templateStorageService.DeleteTemplate(storedFile.RelativeFilePath);
                }

                return Results.BadRequest(new ApiError("VALIDATION_ERROR", exception.Message));
            }
        })
            .DisableAntiforgery();

        group.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.DocumentsManage)] async (
            Guid id,
            ApplicationDbContext dbContext,
            TemplateStorageService templateStorageService,
            CancellationToken cancellationToken) =>
        {
            var template = await dbContext.DocumentTemplates.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (template is null)
            {
                return Results.NotFound(new ApiError("TEMPLATE_NOT_FOUND", "Die Dokumentvorlage wurde nicht gefunden."));
            }

            dbContext.DocumentTemplates.Remove(template);
            await dbContext.SaveChangesAsync(cancellationToken);
            templateStorageService.DeleteTemplate(template.RelativeFilePath);
            return Results.NoContent();
        });

        return endpoints;
    }
}
