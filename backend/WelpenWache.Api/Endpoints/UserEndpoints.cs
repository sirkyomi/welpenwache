using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Security;

namespace WelpenWache.Api.Endpoints;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/users")
            .RequireAuthorization(Policies.AdminOnly);

        group.MapGet("/", async (ApplicationDbContext dbContext) =>
        {
            var users = await dbContext.Users
                .Include(item => item.Permissions)
                .OrderBy(item => item.UserName)
                .ToListAsync();

            return Results.Ok(users.Select(item => item.ToResponse()));
        });

        group.MapPost("/", async (CreateUserRequest request, ApplicationDbContext dbContext) =>
        {
            var userName = request.UserName.Trim();
            var normalizedUserName = ApiValidation.NormalizeKey(userName);
            var permissionValidationError = ApiValidation.ValidatePermissions(request.Permissions);

            if (permissionValidationError is not null)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", permissionValidationError));
            }

            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort mit mindestens 8 Zeichen sind erforderlich."));
            }

            if (await dbContext.Users.AnyAsync(item => item.NormalizedUserName == normalizedUserName))
            {
                return Results.Conflict(new ApiError("USERNAME_EXISTS", "Der Benutzername ist bereits vergeben."));
            }

            var user = new UserAccount
            {
                UserName = userName,
                NormalizedUserName = normalizedUserName,
                PasswordHash = PasswordHasher.Hash(request.Password),
                IsAdministrator = request.IsAdministrator,
                IsActive = request.IsActive,
                LanguagePreference = UserAccount.LanguageGerman,
                ThemePreference = UserAccount.ThemeSystem
            };

            user.Permissions.AddRange(request.Permissions
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(permission => new UserPermission
                {
                    Permission = permission
                }));

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();

            return Results.Created($"/api/users/{user.Id}", user.ToResponse());
        });

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateUserRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext dbContext) =>
        {
            var user = await dbContext.Users
                .Include(item => item.Permissions)
                .SingleOrDefaultAsync(item => item.Id == id);

            if (user is null)
            {
                return Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."));
            }

            var userName = request.UserName.Trim();
            var normalizedUserName = ApiValidation.NormalizeKey(userName);
            var permissionValidationError = ApiValidation.ValidatePermissions(request.Permissions);

            if (permissionValidationError is not null)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", permissionValidationError));
            }

            if (string.IsNullOrWhiteSpace(userName))
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Der Benutzername ist erforderlich."));
            }

            if (!string.IsNullOrWhiteSpace(request.NewPassword) && request.NewPassword.Length < 8)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Ein neues Passwort muss mindestens 8 Zeichen lang sein."));
            }

            if (await dbContext.Users.AnyAsync(item => item.Id != id && item.NormalizedUserName == normalizedUserName))
            {
                return Results.Conflict(new ApiError("USERNAME_EXISTS", "Der Benutzername ist bereits vergeben."));
            }

            if (principal.GetUserId() == id && !request.IsActive)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Der eigene Benutzer kann nicht deaktiviert werden."));
            }

            if (user.IsAdministrator && !request.IsAdministrator)
            {
                var anotherAdminExists = await dbContext.Users.AnyAsync(item => item.Id != id && item.IsAdministrator && item.IsActive);
                if (!anotherAdminExists)
                {
                    return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Es muss mindestens ein aktiver Administrator vorhanden bleiben."));
                }
            }

            user.UserName = userName;
            user.NormalizedUserName = normalizedUserName;
            user.IsAdministrator = request.IsAdministrator;
            user.IsActive = request.IsActive;

            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
            }

            user.Permissions.Clear();
            user.Permissions.AddRange(request.Permissions
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(permission => new UserPermission
                {
                    UserAccountId = user.Id,
                    Permission = permission
                }));

            await dbContext.SaveChangesAsync();
            return Results.Ok(user.ToResponse());
        });

        return endpoints;
    }
}
