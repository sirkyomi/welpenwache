using WelpenWache.Api.Endpoints;
using WelpenWache.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddWelpenWacheApiServices(builder.Configuration, builder.Environment);

var app = builder.Build();

await app.InitializeWelpenWacheApiAsync();
app.UseWelpenWacheApi();
app.MapWelpenWacheApiEndpoints();
app.MapFrontendFallback();

app.Run();
