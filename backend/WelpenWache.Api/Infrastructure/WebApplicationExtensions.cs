using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Data;

namespace WelpenWache.Api.Infrastructure;

public static class WebApplicationExtensions
{
    public static async Task<WebApplication> InitializeWelpenWacheApiAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await dbContext.Database.MigrateAsync();
        return app;
    }

    public static WebApplication UseWelpenWacheApi(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseCors("frontend");
        }
        else
        {
            app.Use(async (context, next) =>
            {
                if (HttpMethods.IsGet(context.Request.Method)
                    && (context.Request.Path == "/" || context.Request.Path == "/index.html"))
                {
                    await FrontendIndexResponder.ServeFrontendIndexAsync(context, app.Environment);
                    return;
                }

                await next();
            });

            app.UseStaticFiles();
        }

        app.UseAuthentication();
        app.UseAuthorization();

        return app;
    }

    public static WebApplication MapFrontendFallback(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            return app;
        }

        app.MapFallback("{*path:nonfile}", async context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            await FrontendIndexResponder.ServeFrontendIndexAsync(context, app.Environment);
        });

        return app;
    }
}
