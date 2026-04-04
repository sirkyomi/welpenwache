using System.Security.Claims;

namespace WelpenWache.Api.Security;

public static class ClaimsPrincipalExtensions
{
    public static bool IsAdministrator(this ClaimsPrincipal principal) =>
        principal.IsInRole("Administrator");

    public static bool HasPermission(this ClaimsPrincipal principal, string permission) =>
        principal.Claims.Any(claim => claim.Type == "permission" && string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase));

    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var rawUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return rawUserId is not null && Guid.TryParse(rawUserId, out var userId)
            ? userId
            : Guid.Empty;
    }
}
