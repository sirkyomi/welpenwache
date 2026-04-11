using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Security;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWelpenWacheApiServices(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var jwtOptions = JwtOptions.Resolve(configuration, environment);

        services.AddSingleton(jwtOptions);
        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseSqlServer(DesignTimeDbContextFactory.ResolveConnectionString(configuration));
        });
        services.Configure<DocumentStorageOptions>(configuration.GetSection("DocumentStorage"));
        services.Configure<CompletionDocumentOptions>(configuration.GetSection("CompletionDocuments"));
        services.AddHttpContextAccessor();
        services.AddScoped<JwtTokenService>();
        services.AddScoped<AuditLogService>();
        services.AddSingleton<TemplateStorageService>();
        services.AddSingleton<CompletionDocumentService>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateIssuerSigningKey = true,
                    ValidateLifetime = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidAudience = jwtOptions.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = ClaimTypes.Name,
                    RoleClaimType = ClaimTypes.Role
                };
            });
        services.AddAuthorization(options =>
        {
            options.AddPolicy(Policies.AdminOnly, policy =>
                policy.RequireAssertion(context => context.User.IsAdministrator()));

            foreach (var permission in PermissionCatalog.All)
            {
                options.AddPolicy(permission, policy =>
                    policy.RequireAssertion(context =>
                        context.User.IsAdministrator() || context.User.HasPermission(permission)));
            }
        });
        services.AddCors(options =>
        {
            options.AddPolicy("frontend", policy =>
                policy.WithOrigins(configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .WithExposedHeaders("Content-Disposition"));
        });

        return services;
    }
}
