using WelpenWache.Api.Contracts;
using WelpenWache.Api.Infrastructure;

namespace WelpenWache.Api.Endpoints;

public static class SystemEndpoints
{
    public static IEndpointRouteBuilder MapSystemEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
        endpoints.MapGet("/api/version", () =>
        {
            var version = AppVersionResolver.ResolveApplicationVersion();
            return Results.Ok(new AppVersionResponse(version));
        });

        return endpoints;
    }
}
