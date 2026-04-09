namespace WelpenWache.Api.Endpoints;

public static class EndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapWelpenWacheApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapSystemEndpoints();
        endpoints.MapSetupEndpoints();
        endpoints.MapAuthEndpoints();
        endpoints.MapUserEndpoints();
        endpoints.MapTeamEndpoints();
        endpoints.MapInternEndpoints();
        endpoints.MapDocumentTemplateEndpoints();
        endpoints.MapCalendarEndpoints();

        return endpoints;
    }
}
