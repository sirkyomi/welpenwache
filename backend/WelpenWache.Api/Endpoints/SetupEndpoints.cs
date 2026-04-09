using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Infrastructure;
using WelpenWache.Api.Security;

namespace WelpenWache.Api.Endpoints;

public static class SetupEndpoints
{
    public static IEndpointRouteBuilder MapSetupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/setup");

        group.MapGet("/status", async (ApplicationDbContext dbContext) =>
        {
            var requiresSetup = !await dbContext.Users.AnyAsync();
            return Results.Ok(new SetupStatusResponse(requiresSetup));
        });

        group.MapPost("/admin", async (
            SetupAdminRequest request,
            ApplicationDbContext dbContext,
            JwtTokenService tokenService) =>
        {
            var userName = request.UserName.Trim();

            if (await dbContext.Users.AnyAsync())
            {
                return Results.Conflict(new ApiError("SETUP_COMPLETED", "Die Initialkonfiguration wurde bereits abgeschlossen."));
            }

            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort mit mindestens 8 Zeichen sind erforderlich."));
            }

            var adminUser = new UserAccount
            {
                UserName = userName,
                NormalizedUserName = ApiValidation.NormalizeKey(userName),
                PasswordHash = PasswordHasher.Hash(request.Password),
                IsAdministrator = true,
                LanguagePreference = UserAccount.LanguageGerman,
                ThemePreference = UserAccount.ThemeSystem
            };

            adminUser.Permissions.AddRange(PermissionCatalog.All.Select(permission => new UserPermission
            {
                Permission = permission
            }));

            dbContext.Users.Add(adminUser);
            await dbContext.SaveChangesAsync();

            return Results.Created("/api/setup/status", tokenService.CreateToken(adminUser));
        });

        return endpoints;
    }
}
