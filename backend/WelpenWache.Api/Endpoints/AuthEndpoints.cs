using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Security;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");

        group.MapPost("/login", async (
            LoginRequest request,
            ApplicationDbContext dbContext,
            JwtTokenService tokenService) =>
        {
            var userName = request.UserName.Trim();
            var normalizedUserName = ApiValidation.NormalizeKey(userName);

            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort sind erforderlich."));
            }

            var user = await dbContext.Users
                .Include(item => item.Permissions)
                .SingleOrDefaultAsync(item => item.NormalizedUserName == normalizedUserName);

            if (user is null || !user.IsActive || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            return Results.Ok(tokenService.CreateToken(user));
        });

        group.MapGet("/me", [Authorize] async (
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext) =>
        {
            var userId = principal.GetUserId();
            var user = await dbContext.Users
                .Include(item => item.Permissions)
                .SingleOrDefaultAsync(item => item.Id == userId);

            return user is null
                ? Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."))
                : Results.Ok(user.ToResponse());
        });

        group.MapPut("/theme", [Authorize] async (
            UpdateThemePreferenceRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            if (!UserAccount.IsValidThemePreference(request.ThemePreference))
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Die Theme-Einstellung ist ungueltig."));
            }

            var userId = principal.GetUserId();
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "user", userId, cancellationToken);
            var user = await dbContext.Users
                .Include(item => item.Permissions)
                .SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."));
            }

            user.ThemePreference = request.ThemePreference;
            await dbContext.SaveChangesAsync(cancellationToken);
            if (auditCapture is not null)
            {
                await auditLogService.WriteUpdateAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            return Results.Ok(user.ToResponse());
        });

        group.MapPut("/language", [Authorize] async (
            UpdateLanguagePreferenceRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext,
            AuditLogService auditLogService,
            CancellationToken cancellationToken) =>
        {
            if (!UserAccount.IsValidLanguagePreference(request.LanguagePreference))
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Die Spracheinstellung ist ungueltig."));
            }

            var userId = principal.GetUserId();
            var auditCapture = await auditLogService.CaptureAsync(dbContext, "user", userId, cancellationToken);
            var user = await dbContext.Users
                .Include(item => item.Permissions)
                .SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."));
            }

            user.LanguagePreference = request.LanguagePreference;
            await dbContext.SaveChangesAsync(cancellationToken);
            if (auditCapture is not null)
            {
                await auditLogService.WriteUpdateAsync(dbContext, principal, auditCapture, cancellationToken);
            }

            return Results.Ok(user.ToResponse());
        });

        return endpoints;
    }
}
